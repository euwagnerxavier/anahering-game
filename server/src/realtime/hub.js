// Hub de presença: "Ecos Reais" de outros jogadores + Aplausômetro Global.
import { checkNickname } from '../moderation.js';

const WORLD_LIMIT = 260; // metros a partir do centro (o mapa tem ~400 m)
const SNAPSHOT_HZ = 10;
const IDLE_TIMEOUT_MS = 60_000;
const r1 = (n) => Math.round(n * 10) / 10;

/** Token bucket simples. */
class Bucket {
  constructor(rate, burst) {
    this.rate = rate;
    this.burst = burst;
    this.tokens = burst;
    this.last = Date.now();
  }
  take() {
    const now = Date.now();
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export function createHub({ db, config, log }) {
  const players = new Map(); // id -> player
  const perIp = new Map(); // ipHash -> count
  let nextId = 1;
  let applauseTotal = db.getCounter('applause');
  let applausePending = 0;
  let applauseDirty = false;

  const send = (ws, msg) => {
    if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  };
  const broadcast = (msg, exceptId) => {
    const data = JSON.stringify(msg);
    for (const p of players.values()) if (p.id !== exceptId && p.ready) send(p.ws, data);
  };

  function handleConnection(ws, { ipHash }) {
    if (players.size >= config.maxPlayers) {
      ws.close(1013, 'Reino lotado');
      return;
    }
    const count = perIp.get(ipHash) || 0;
    if (count >= config.maxConnPerIp) {
      ws.close(1008, 'Muitas conexões');
      return;
    }
    perIp.set(ipHash, count + 1);

    const p = {
      id: nextId++,
      ws,
      ipHash,
      name: 'Súdito',
      ready: false,
      x: 0, y: 0, z: 0, r: 0, a: 0,
      lastSeen: Date.now(),
      posBucket: new Bucket(12, 20),
      msgBucket: new Bucket(20, 30),
      applaudBucket: new Bucket(2, 4),
      strikes: 0,
    };
    players.set(p.id, p);

    const strike = () => {
      if (++p.strikes > 20) ws.close(1008, 'Abuso');
    };

    ws.on('message', (raw, isBinary) => {
      if (isBinary || raw.length > 512) return strike();
      if (!p.msgBucket.take()) return strike();
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return strike();
      }
      if (!msg || typeof msg.t !== 'string') return strike();
      p.lastSeen = Date.now();

      switch (msg.t) {
        case 'hello': {
          if (p.ready) return;
          const nick = checkNickname(msg.name);
          p.name = nick.ok ? nick.value : `Súdito ${p.id}`;
          p.ready = true;
          send(ws, {
            t: 'welcome',
            id: p.id,
            name: p.name,
            applause: applauseTotal + applausePending,
            players: [...players.values()].filter((o) => o.ready && o.id !== p.id).map((o) => ({ id: o.id, name: o.name })),
          });
          broadcast({ t: 'join', id: p.id, name: p.name }, p.id);
          break;
        }
        case 'pos': {
          if (!p.ready || !p.posBucket.take()) return;
          const [x, y, z] = Array.isArray(msg.p) ? msg.p : [];
          if (![x, y, z, msg.r].every(Number.isFinite)) return strike();
          p.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, x));
          p.y = Math.max(-20, Math.min(120, y));
          p.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, z));
          p.r = msg.r;
          p.a = Number.isInteger(msg.a) && msg.a >= 0 && msg.a <= 4 ? msg.a : 0;
          p.moved = true;
          break;
        }
        case 'applaud': {
          if (!p.ready || !p.applaudBucket.take()) return;
          applausePending++;
          applauseDirty = true;
          break;
        }
        case 'ping':
          send(ws, { t: 'pong' });
          break;
        default:
          strike();
      }
    });

    ws.on('close', () => {
      players.delete(p.id);
      const c = (perIp.get(ipHash) || 1) - 1;
      if (c <= 0) perIp.delete(ipHash);
      else perIp.set(ipHash, c);
      if (p.ready) broadcast({ t: 'leave', id: p.id });
    });
    ws.on('error', (err) => log.warn({ err: err.message }, 'ws error'));
  }

  // Snapshots de posição a 10 Hz.
  const snapTimer = setInterval(() => {
    const ready = [...players.values()].filter((p) => p.ready);
    if (ready.length < 2) return;
    const s = ready.map((p) => [p.id, r1(p.x), r1(p.y), r1(p.z), r1(p.r), p.a]);
    broadcast({ t: 'snap', s });
  }, 1000 / SNAPSHOT_HZ);

  // Aplausômetro: persiste e transmite no máximo 1x/s.
  const applauseTimer = setInterval(() => {
    if (!applauseDirty) return;
    applauseDirty = false;
    db.addCounter('applause', applausePending);
    applauseTotal += applausePending;
    applausePending = 0;
    broadcast({ t: 'applause', total: applauseTotal });
  }, 1000);

  // Encerra conexões inativas.
  const idleTimer = setInterval(() => {
    const now = Date.now();
    for (const p of players.values()) if (now - p.lastSeen > IDLE_TIMEOUT_MS) p.ws.close(1000, 'Inativo');
  }, 10_000);

  return {
    handleConnection,
    broadcast,
    get playerCount() {
      return [...players.values()].filter((p) => p.ready).length;
    },
    get applauseTotal() {
      return applauseTotal + applausePending;
    },
    close() {
      clearInterval(snapTimer);
      clearInterval(applauseTimer);
      clearInterval(idleTimer);
      if (applausePending) db.addCounter('applause', applausePending);
      for (const p of players.values()) p.ws.close(1001, 'Servidor reiniciando');
    },
  };
}
