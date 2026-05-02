import type { SQSEvent } from 'aws-lambda';
import { DynamoDBOrdersRepository } from '../infra/orders-repository.js';
import { EventBridgePublisher } from '../infra/event-publisher.js';
import { createLogger } from '../infra/logger.js';
import { createOrderCompletedEvent, ORDER_COMPLETED } from '../domain/events.js';
import { withLambdaHandler } from '../lib/middleware.js';

const logger = createLogger();
const repo = new DynamoDBOrdersRepository();
const publisher = new EventBridgePublisher();

async function handleComplete(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    const raw = JSON.parse(record.body);
    const { orderId, tenantId } = raw.detail as { orderId: string; tenantId: string };

    const order = await repo.get(tenantId, orderId);
    if (!order) {
      logger.warn('Order not found for completion', { orderId, tenantId });
      continue;
    }

    await repo.updateStatus(tenantId, orderId, 'completed');
    const completedOrder = await repo.get(tenantId, orderId);
    if (completedOrder) {
      await publisher.publish(ORDER_COMPLETED, createOrderCompletedEvent(completedOrder).detail);
    }
    logger.info('Order completed', { orderId, tenantId });
  }
}

export const completeHandler = withLambdaHandler(handleComplete, { isSQS: true });
