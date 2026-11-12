// Mural de Lealdade: decretos reais públicos.
import { checkDecree, checkNickname } from '../moderation.js';

const DAY = 24 * 60 * 60 * 1000;

export default async function decreeRoutes(app, { db, hub, config, ipHash }) {
  app.get(
    '/api/decrees',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        querystring: {
          type: 'object',
          properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
          additionalProperties: false,
        },
      },
    },
    async (req) => ({ decrees: db.listDecrees(req.query.limit) })
  );

  app.post(
    '/api/decrees',
    {
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['author', 'text'],
          properties: {
            author: { type: 'string', maxLength: 40 },
            text: { type: 'string', maxLength: 400 },
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const author = checkNickname(req.body.author);
      if (!author.ok) return reply.code(422).send({ error: author.reason });
      const text = checkDecree(req.body.text);
      if (!text.ok) return reply.code(422).send({ error: text.reason });

      const hash = ipHash(req);
      if (db.countDecreesSince(hash, Date.now() - DAY) >= config.decreesPerDayPerIp) {
        return reply.code(429).send({ error: 'Vossa Majestade já decretou demais hoje. O reino precisa de descanso.' });
      }
      const decree = db.insertDecree({ author: author.value, text: text.value, ipHash: hash });
      hub.broadcast({ t: 'decree', decree });
      req.log.info({ id: decree.id }, 'decree created');
      return reply.code(201).send({ decree });
    }
  );

  app.post(
    '/api/decrees/:id/report',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } } } },
    },
    async (req, reply) => {
      db.report(req.params.id, ipHash(req));
      return reply.code(204).send();
    }
  );

  app.delete(
    '/api/admin/decrees/:id',
    { schema: { params: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } } } } },
    async (req, reply) => {
      const auth = req.headers.authorization || '';
      if (!config.adminToken || auth !== `Bearer ${config.adminToken}`) {
        return reply.code(401).send({ error: 'Apenas a Coroa pode fazer isso.' });
      }
      const ok = db.hideDecree(req.params.id);
      return reply.code(ok ? 204 : 404).send();
    }
  );
}
