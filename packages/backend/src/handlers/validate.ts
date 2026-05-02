import type { SQSEvent } from 'aws-lambda';
import { DynamoDBOrdersRepository } from '../infra/orders-repository.js';
import { EventBridgePublisher } from '../infra/event-publisher.js';
import { createLogger } from '../infra/logger.js';
import {
  createOrderValidatedEvent,
  createOrderFailedEvent,
  ORDER_VALIDATED,
  ORDER_FAILED,
} from '../domain/events.js';
import { validateBusinessRules } from '../domain/validation.js';
import { withLambdaHandler } from '../lib/middleware.js';

const logger = createLogger();
const repo = new DynamoDBOrdersRepository();
const publisher = new EventBridgePublisher();

async function handleValidate(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    const raw = JSON.parse(record.body);
    const { orderId, tenantId } = raw.detail as { orderId: string; tenantId: string };

    const order = await repo.get(tenantId, orderId);
    if (!order) {
      logger.warn('Order not found for validation', { orderId, tenantId });
      continue;
    }

    const validation = validateBusinessRules(order);
    if (!validation.valid) {
      const failureReason = validation.errors.join('; ');
      await repo.updateStatus(tenantId, orderId, 'failed', { failureReason });
      const failedOrder = await repo.get(tenantId, orderId);
      if (failedOrder) {
        await publisher.publish(ORDER_FAILED, createOrderFailedEvent(failedOrder, failureReason).detail);
      }
      logger.warn('Order validation failed', { orderId, tenantId, errors: validation.errors });
      continue;
    }

    await repo.updateStatus(tenantId, orderId, 'validated');
    const validatedOrder = await repo.get(tenantId, orderId);
    if (validatedOrder) {
      await publisher.publish(ORDER_VALIDATED, createOrderValidatedEvent(validatedOrder).detail);
    }
    logger.info('Order validated', { orderId, tenantId });
  }
}

export const validateHandler = withLambdaHandler(handleValidate, { isSQS: true });
