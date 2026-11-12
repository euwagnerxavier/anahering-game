// Configuração lida do ambiente, com valores padrão seguros.
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const int = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);

export function loadConfig(overrides = {}) {
  const env = process.env;
  const dev = process.argv.includes('--dev') || env.NODE_ENV === 'development';
  const cfg = {
    dev,
    host: env.HOST || '127.0.0.1',
    port: int(env.PORT, 3000),
    dbPath: env.DB_PATH || path.resolve(here, '../data/anahering.db'),
    staticDir: env.STATIC_DIR || path.resolve(here, '../../client/dist'),
    // Sal do hash de IP. Em produção defina IP_SALT fixo para que os limites diários sobrevivam a reinícios.
    ipSalt: env.IP_SALT || randomBytes(16).toString('hex'),
    adminToken: env.ADMIN_TOKEN || '',
    // Confiar em CF-Connecting-IP apenas quando a conexão vem do cloudflared local.
    trustCloudflare: env.TRUST_CLOUDFLARE !== 'false',
    // Lista separada por vírgula. Vazio = aceita apenas a mesma origem do Host.
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    maxPlayers: int(env.MAX_PLAYERS, 100),
    maxConnPerIp: int(env.MAX_CONN_PER_IP, 3),
    decreesPerDayPerIp: int(env.DECREES_PER_DAY, 20),
    eventIntervalMs: int(env.EVENT_INTERVAL_MS, 8 * 60 * 1000),
    ...overrides,
  };
  if (!dev && !env.IP_SALT && !overrides.ipSalt) {
    console.warn('[config] IP_SALT não definido: usando sal aleatório (limites diários reiniciam no restart).');
  }
  return cfg;
}
