import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url().refine(value => /^postgres(?:ql)?:/.test(value)),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FIDEL_WEBHOOK_SECRET: z.string().min(1),
  FIDEL_WEBHOOK_URL: z.url().refine(value => {
    const url = new URL(value);
    return !url.username && !url.password && !url.hash &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)));
  }),
  FIDEL_ACCOUNT_ID: z.uuid(),
  FIDEL_PROGRAM_ID: z.uuid(),
});

export function readConfig(environment: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(environment);
  if (!result.success) throw new Error(`Invalid configuration: ${result.error.issues.map(issue => issue.path.join('.')).join(', ')}`);
  const env = result.data;
  return {
    port: env.PORT, databaseUrl: env.DATABASE_URL,
    fidel: {
      secret: env.FIDEL_WEBHOOK_SECRET, webhookUrl: env.FIDEL_WEBHOOK_URL,
      accountId: env.FIDEL_ACCOUNT_ID, programId: env.FIDEL_PROGRAM_ID,
    },
  };
}
