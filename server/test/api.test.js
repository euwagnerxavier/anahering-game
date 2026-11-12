import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { buildServer } from '../src/index.js';
import { checkDecree, checkNickname } from '../src/moderation.js';

const make = () => buildServer({ dbPath: ':memory:', logger: false, quietStatic: true, ipSalt: 'test', eventIntervalMs: 999999 });

test('moderação aceita decretos normais e bloqueia impróprios', () => {
  assert.equal(checkDecree('Fica decretado que toda segunda é domingo! 👑').ok, true);
  assert.equal(checkDecree('p0rr4 de reino').ok, false);
  assert.equal(checkDecree('visite www.exemplo.com').ok, false);
  assert.equal(checkDecree('a'.repeat(141)).ok, false);
  assert.equal(checkNickname('Wagner').ok, true);
  assert.equal(checkNickname('<script>').ok, false);
});

test('POST e GET de decretos', async () => {
  const { app } = await make();
  const res = await app.inject({ method: 'POST', url: '/api/decrees', payload: { author: 'Wagner', text: 'Bolo de graça para todos os súditos!' } });
  assert.equal(res.statusCode, 201);
  const list = await app.inject({ method: 'GET', url: '/api/decrees' });
  assert.equal(list.json().decrees.length, 1);
  assert.equal(list.json().decrees[0].author, 'Wagner');
  assert.ok(list.headers['content-security-policy']);
  await app.close();
});

test('rejeita decreto impróprio com 422 e campos extras com 400', async () => {
  const { app } = await make();
  let res = await app.inject({ method: 'POST', url: '/api/decrees', payload: { author: 'X y', text: 'merda' } });
  assert.equal(res.statusCode, 422);
  res = await app.inject({ method: 'POST', url: '/api/decrees', payload: { author: 'Xy', text: 'ola ola', extra: 1 } });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test('rate limit de decretos (3/min)', async () => {
  const { app } = await make();
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const r = await app.inject({ method: 'POST', url: '/api/decrees', payload: { author: 'Wagner', text: `Decreto número ${i + 1}` } });
    codes.push(r.statusCode);
  }
  assert.deepEqual(codes, [201, 201, 201, 429, 429]);
  await app.close();
});

test('denúncias escondem decreto após 3 IPs distintos e admin exige token', async () => {
  const { app } = await make();
  const r = await app.inject({ method: 'POST', url: '/api/decrees', payload: { author: 'Wagner', text: 'Decreto polêmico' } });
  const id = r.json().decree.id;
  for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
    await app.inject({ method: 'POST', url: `/api/decrees/${id}/report`, headers: { 'cf-connecting-ip': ip }, remoteAddress: '127.0.0.1' });
  }
  assert.equal((await app.inject('/api/decrees')).json().decrees.length, 0);
  const del = await app.inject({ method: 'DELETE', url: `/api/admin/decrees/${id}` });
  assert.equal(del.statusCode, 401);
  await app.close();
});

test('websocket: hello, presença e aplausos', async () => {
  const { app } = await make();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = app.server.address().port;
  const open = (name) =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}` });
      const msgs = [];
      ws.on('message', (d) => msgs.push(JSON.parse(d)));
      ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', name })); resolve({ ws, msgs }); });
      ws.on('error', reject);
    });
  const a = await open('Rainha A');
  const b = await open('Rainha B');
  await new Promise((r) => setTimeout(r, 150));
  a.ws.send(JSON.stringify({ t: 'pos', p: [10, 0, 5], r: 1.2, a: 1 }));
  a.ws.send(JSON.stringify({ t: 'applaud' }));
  await new Promise((r) => setTimeout(r, 1300));
  assert.ok(a.msgs.find((m) => m.t === 'welcome'));
  assert.ok(a.msgs.find((m) => m.t === 'join' && m.name === 'Rainha B'));
  const snap = b.msgs.filter((m) => m.t === 'snap').pop();
  assert.ok(snap.s.find((e) => e[1] === 10 && e[3] === 5));
  assert.ok(b.msgs.find((m) => m.t === 'applause' && m.total === 1));
  a.ws.close(); b.ws.close();
  await app.close();
});

test('websocket rejeita origem estranha', async () => {
  const { app } = await make();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = app.server.address().port;
  const code = await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'https://malvado.example' });
    ws.on('close', (c) => resolve(c));
  });
  assert.equal(code, 1008);
  await app.close();
});

test('serve o jogo compilado com cache imutável em /assets', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anahering-static-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Reino</title>');
  fs.writeFileSync(path.join(dir, 'assets', 'app-123.js'), 'console.log(1)');
  const { app } = await buildServer({ dbPath: ':memory:', logger: false, staticDir: dir, ipSalt: 'test', eventIntervalMs: 999999 });
  const html = await app.inject('/');
  assert.equal(html.statusCode, 200);
  assert.equal(html.headers['cache-control'], 'no-cache');
  const js = await app.inject('/assets/app-123.js');
  assert.equal(js.statusCode, 200);
  assert.match(js.headers['cache-control'], /immutable/);
  await app.close();
});
