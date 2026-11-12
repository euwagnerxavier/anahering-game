// Servidor do Reino de Heringuia: estáticos + API REST + WebSocket, num único processo (ADR-004).
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createHub } from './realtime/hub.js';
import { startEvents } from './realtime/events.js';
import decreeRoutes from './routes/decrees.js';

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export async function buildServer(overrides = {}) {
  const config = loadConfig(overrides);
  const app = Fastify({
    logger: overrides.logger ?? (config.dev ? { level: 'info' } : { level: 'info' }),
    bodyLimit: 2048,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: true, useDefaults: true } },
    trustProxy: false,
  });

  /** IP real do cliente: CF-Connecting-IP só é confiável quando vem do cloudflared local. */
  const clientIp = (req) => {
    const remote = req.socket?.remoteAddress || req.ip;
    const cf = req.headers['cf-connecting-ip'];
    if (config.trustCloudflare && cf && LOOPBACK.has(remote)) return String(cf);
    return remote;
  };
  const ipHash = (req) => createHash('sha256').update(config.ipSalt + clientIp(req)).digest('hex').slice(0, 32);

  const db = openDb(config.dbPath);
  const hub = createHub({ db, config, log: app.log });
  const stopEvents = startEvents(hub, config.eventIntervalMs);

  app.addHook('onClose', async () => {
    stopEvents();
    hub.close();
    db.close();
  });

  // Cabeçalhos de segurança.
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
        "connect-src 'self' ws: wss:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
    return payload;
  });

  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode && err.statusCode < 600 ? err.statusCode : 500;
    if (status >= 500) req.log.error(err);
    const message =
      status === 429
        ? 'Calma, Majestade! Muitas ordens em pouco tempo.'
        : status < 500
          ? err.validation
            ? 'Pedido inválido.'
            : err.message
          : 'O castelo tropeçou. Tente novamente.';
    reply.code(status).send({ error: message });
  });

  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
    keyGenerator: ipHash,
    errorResponseBuilder: () => {
      const e = new Error('rate limited');
      e.statusCode = 429;
      return e;
    },
  });

  await app.register(fastifyWebsocket, {
    options: { maxPayload: 512, perMessageDeflate: false },
  });

  const originAllowed = (req) => {
    const origin = req.headers.origin;
    if (!origin) return config.dev; // navegadores sempre enviam Origin
    if (config.allowedOrigins.length) return config.allowedOrigins.includes(origin);
    try {
      const u = new URL(origin);
      if (config.dev && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;
      return u.host === req.headers.host;
    } catch {
      return false;
    }
  };

  app.get('/ws', { websocket: true, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, (socket, req) => {
    if (!originAllowed(req)) {
      socket.close(1008, 'Origem não permitida');
      return;
    }
    hub.handleConnection(socket, { ipHash: ipHash(req) });
  });

  app.get('/api/health', async () => ({ ok: true, uptime: Math.round(process.uptime()), players: hub.playerCount }));
  app.get('/api/applause', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async () => ({
    total: hub.applauseTotal,
  }));

  await app.register(decreeRoutes, { db, hub, config, ipHash });

  // Jogo compilado (client/dist). Assets com hash podem ser cacheados para sempre (Cloudflare).
  if (fs.existsSync(config.staticDir)) {
    await app.register(fastifyStatic, {
      root: config.staticDir,
      setHeaders(res, filePath) {
        // v10+ passa o reply do Fastify; versões antigas passam o ServerResponse
        const set = typeof res.setHeader === 'function' ? res.setHeader.bind(res) : res.header.bind(res);
        if (/[\\/]assets[\\/]/.test(filePath)) set('Cache-Control', 'public, max-age=31536000, immutable');
        else set('Cache-Control', 'no-cache');
      },
    });
  } else if (!overrides.quietStatic) {
    app.log.warn(`Pasta estática ${config.staticDir} não existe. Rode "npm run build" ou use o Vite em dev.`);
  }

  app.decorate('hub', hub);
  app.decorate('db', db);
  return { app, config };
}

// Execução direta: node src/index.js
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const { app, config } = await buildServer();
  const shutdown = async (sig) => {
    app.log.info(`${sig} recebido, encerrando...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await app.listen({ host: config.host, port: config.port });
}
