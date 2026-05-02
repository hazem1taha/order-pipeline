import type { SQSEvent } from 'aws-lambda';
import { DynamoDBOrdersRepository } from '../infra/orders-repository.js';
import { EventBridgePublisher } from '../infra/event-publisher.js';
import { createLogger } from '../infra/logger.js';
import {
  createOrderEnrichedEvent,
  createOrderFailedEvent,
  ORDER_ENRICHED,
  ORDER_FAILED,
} from '../domain/events.js';
import { withLambdaHandler } from '../lib/middleware.js';

const logger = createLogger();
const repo = new DynamoDBOrdersRepository();
const publisher = new EventBridgePublisher();

const MOCK_PRODUCTS: Record<string, { name: string; category: string }> = {
  'prod-789': { name: 'Organic Protein Bar', category: 'nutrition' },
  'prod-001': { name: 'Energy Drink', category: 'beverages' },
  'prod-002': { name: 'Mixed Nuts Pack', category: 'snacks' },
  'prod-003': { name: 'Vitamin D3 Supplement', category: 'supplements' },
  'prod-004': { name: 'Instant Oatmeal', category: 'breakfast' },
  'prod-005': { name: 'Green Tea Blend', category: 'beverages' },
};

type LineItem = { productId: string; quantity: number; unitPrice: number };

async function enrichLineItem(item: LineItem): Promise<LineItem & { productName: string; category: string }> {
  const mock = MOCK_PRODUCTS[item.productId] ?? {
    name: `Product ${item.productId}`,
    category: 'general',
  };
  return { ...item, productName: mock.name, category: mock.category };
}

async function handleEnrich(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    const raw = JSON.parse(record.body);
    const { orderId, tenantId } = raw.detail as { orderId: string; tenantId: string };

    const order = await repo.get(tenantId, orderId);
    if (!order) {
      logger.warn('Order not found for enrichment', { orderId, tenantId });
      continue;
    }

    const enrichedLineItems = await Promise.all(order.lineItems.map(enrichLineItem));

    await repo.updateStatus(tenantId, orderId, 'enriched', { lineItems: enrichedLineItems });
    const enrichedOrder = await repo.get(tenantId, orderId);
    if (enrichedOrder) {
      await publisher.publish(ORDER_ENRICHED, createOrderEnrichedEvent(enrichedOrder).detail);
    }
    logger.info('Order enriched', { orderId, tenantId });
  }
}

export const enrichHandler = withLambdaHandler(handleEnrich, { isSQS: true });
