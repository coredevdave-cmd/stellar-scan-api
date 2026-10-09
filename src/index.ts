import Fastify from 'fastify';
import mercurius from 'mercurius';
import { loadConfig } from './config.js';
import { logger } from './utils/logger.js';
import { createPool } from './utils/db.js';
import { errorHandler } from './middleware/error_handler.js';
import { registerCors } from './middleware/cors.js';
import { registerRateLimit } from './middleware/rate_limit.js';
import { ContractService } from './services/contract_service.js';
import { SearchService } from './services/search_service.js';
import { SimulateService } from './services/simulate_service.js';
import { TagService } from './services/tag_service.js';
import { healthRoutes } from './routes/health.js';
import { contractRoutes } from './routes/contracts.js';
import { functionRoutes } from './routes/functions.js';
import { eventRoutes } from './routes/events.js';
import { deployerRoutes } from './routes/deployers.js';
import { searchRoutes } from './routes/search.js';
import { simulateRoutes } from './routes/simulate.js';
import { tagRoutes } from './routes/tags.js';

const cfg = loadConfig();
const log = logger(cfg.LOG_LEVEL);
const pool = createPool(cfg.DATABASE_URL);
const app = Fastify({ logger: log });
app.setErrorHandler(errorHandler);
await registerCors(app);
await registerRateLimit(app);

const contractSvc = new ContractService(pool);
await healthRoutes(app, pool);
await contractRoutes(app, contractSvc);
await functionRoutes(app, pool);
await eventRoutes(app, pool);
await deployerRoutes(app, pool);
await searchRoutes(app, new SearchService(pool));
await simulateRoutes(app, new SimulateService(cfg.STELLAR_RPC_URL));
await tagRoutes(app, new TagService(pool));

const schema = `type Contract { contractId: String deployer: String verified: Boolean }
  type Query { contract(id: String!): Contract }`;

await app.register(mercurius, {
  schema,
  resolvers: { Query: { contract: async (_: unknown, { id }: { id: string }) => contractSvc.getById(id) } },
  graphiql: true,
});

const shutdown = async (signal: string) => {
  log.info({ signal }, 'shutting down stellar-scan-api');
  await app.close();
  await pool.end();
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: cfg.PORT, host: '0.0.0.0' });
