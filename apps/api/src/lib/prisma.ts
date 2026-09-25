import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export function createPrisma(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({
    connectionString, max: 10, connectionTimeoutMillis: 3000, statement_timeout: 5000,
  }) });
}
