import 'dotenv/config';
import { createApp } from './app.js';
import { readConfig } from './lib/config.js';
import { createPrisma } from './lib/prisma.js';
import { PrismaStampRepository } from './repositories/stamps.js';

const config = readConfig();
const prisma = createPrisma(config.databaseUrl);
await prisma.$connect();
const server = createApp(config.fidel, new PrismaStampRepository(prisma)).listen(config.port, () => {
  console.info(`Loyalty API listening on port ${config.port}`);
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => { void prisma.$disconnect(); });
  });
}
