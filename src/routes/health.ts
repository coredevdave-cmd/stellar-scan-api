import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

export async function healthRoutes(app: FastifyInstance, pool: Pool) {
  // Liveness must remain independent of downstream services so orchestrators
  // do not restart a healthy process during a transient database outage.
  app.get('/health', async () => ({
    status: 'ok',
    service: 'stellar-scan-api',
  }));

  // Readiness is the dependency-aware probe used by load balancers. A failed
  // database check returns a 503 instead of looking healthy to callers.
  app.get('/ready', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready', service: 'stellar-scan-api' };
    } catch {
      return reply.status(503).send({
        status: 'not_ready',
        service: 'stellar-scan-api',
      });
    }
  });
}
