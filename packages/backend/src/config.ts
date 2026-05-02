import { z } from 'zod';

const ConfigSchema = z.object({
  AWS_REGION: z.string().default('eu-west-1'),
  STAGE: z.string().default('local'),
  DYNAMODB_TABLE_NAME: z.string(),
  EVENT_BUS_NAME: z.string(),
  LOCALSTACK_URL: z.string().url().optional(),
  DLQ_MONITOR_SCHEDULE: z.string().default('rate(5 minutes)'),
  IDEMPOTENCY_WINDOW_DAYS: z.coerce.number().int().default(30),
  ENVIRONMENT: z.enum(['development', 'production', 'local']).default('local'),
});

const raw = {
  AWS_REGION: process.env.AWS_REGION,
  STAGE: process.env.STAGE,
  DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME,
  EVENT_BUS_NAME: process.env.EVENT_BUS_NAME,
  LOCALSTACK_URL: process.env.LOCALSTACK_URL,
  DLQ_MONITOR_SCHEDULE: process.env.DLQ_MONITOR_SCHEDULE,
  IDEMPOTENCY_WINDOW_DAYS: process.env.IDEMPOTENCY_WINDOW_DAYS,
  ENVIRONMENT: process.env.ENVIRONMENT,
};

const result = ConfigSchema.safeParse(raw);

if (!result.success) {
  const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  throw new Error(`Invalid config: ${errors}`);
}

export const config = result.data;

export type Config = z.infer<typeof ConfigSchema>;
