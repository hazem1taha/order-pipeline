import type { APIGatewayProxyResult, SQSEvent } from 'aws-lambda';
import { DynamoDBOrdersRepository } from '../infra/orders-repository.js';
import { EventBridgePublisher } from '../infra/event-publisher.js';
import { createLogger } from '../infra/logger.js';
import { createOrder } from '../domain/order.js';
import {
  createOrderReceivedEvent,
  createOrderValidatedEvent,
  createOrderFailedEvent,
  ORDER_RECEIVED,
} from '../domain/events.js';
import { validateBusinessRules } from '../domain/validation.js';
import {
  withLambdaHandler,
  createAPIGatewayResponse,
  parseJSON,
} from '../lib/middleware.js';
import { z as Zod } from 'zod';
import { OrderValidationError } from '../lib/errors.js';

const logger = createLogger();
const repo = new DynamoDBOrdersRepository();
const publisher = new EventBridgePublisher();

const IngestSchema = Zod.object({
  tenantId: Zod.string().min(1),
  idempotencyKey: Zod.string().min(1),
  customer: Zod.object({
    customerId: Zod.string().min(1),
    email: Zod.string().email(),
  }),
  lineItems: Zod.array(
    Zod.object({
      productId: Zod.string().min(1),
      quantity: Zod.number().int().positive(),
      unitPrice: Zod.number().positive(),
    }),
  ).min(1),
  metadata: Zod.record(Zod.unknown()).optional(),
});

async function handleIngest(
  event: { body: string | null },
  _ctx: { requestId: string },
): Promise<APIGatewayProxyResult> {
  const body = parseJSON(event.body);
  const parseResult = IngestSchema.safeParse(body);
  if (!parseResult.success) {
    throw new OrderValidationError(parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
  }
  const input = parseResult.data;

  // Idempotency check
  const existing = await repo.findByIdempotencyKey(input.tenantId, input.idempotencyKey);
  if (existing && existing.status !== 'failed') {
    logger.info('Idempotent replay, returning existing order', {
      orderId: existing.orderId,
      idempotencyKey: input.idempotencyKey,
    });
    return createAPIGatewayResponse(200, existing);
  }

  // Create order
  const order = createOrder({
    tenantId: input.tenantId,
    idempotencyKey: input.idempotencyKey,
    customer: input.customer,
    lineItems: input.lineItems,
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  });

  // Conditional write (prevent race-condition duplicates)
  try {
    await repo.put(order);
  } catch (err) {
    if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
      throw new OrderValidationError(['Duplicate idempotency key detected (race)']);
    }
    throw err;
  }

  // Publish event
  await publisher.publish(ORDER_RECEIVED, createOrderReceivedEvent(order).detail);
  logger.info('Order ingested', { orderId: order.orderId, tenantId: order.tenantId });

  return createAPIGatewayResponse(201, order);
}

async function handleValidate(
  event: SQSEvent,
  _ctx: { requestId: string },
): Promise<void> {
  for (const record of event.Records) {
    const raw = JSON.parse(record.body);
    const { orderId, tenantId } = raw.detail;

    const order = await repo.get(tenantId, orderId);
    if (!order) {
      logger.warn('Order not found for validation', { orderId, tenantId });
      continue;
    }

    const validation = validateBusinessRules(order);
    if (!validation.valid) {
      await repo.updateStatus(tenantId, orderId, 'failed', {
        failureReason: validation.errors.join('; '),
      });
      const failedOrder = await repo.get(tenantId, orderId);
      if (failedOrder) {
        await publisher.publish('order.failed', createOrderFailedEvent(failedOrder, validation.errors.join('; ')).detail);
      }
      logger.warn('Order validation failed', { orderId, tenantId, errors: validation.errors });
    } else {
      await repo.updateStatus(tenantId, orderId, 'validated');
      const validatedOrder = await repo.get(tenantId, orderId);
      if (validatedOrder) {
        await publisher.publish('order.validated', createOrderValidatedEvent(validatedOrder).detail);
      }
      logger.info('Order validated', { orderId, tenantId });
    }
  }
}

export const ingestHandler = withLambdaHandler(handleIngest);
export const validateHandler = withLambdaHandler(handleValidate, { isSQS: true });
