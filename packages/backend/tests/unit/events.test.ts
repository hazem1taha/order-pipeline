import { createOrder } from '../../src/domain/order';
import {
  createOrderReceivedEvent,
  createOrderValidatedEvent,
  createOrderEnrichedEvent,
  createOrderCompletedEvent,
  createOrderFailedEvent,
  ORDER_RECEIVED,
  ORDER_VALIDATED,
  ORDER_ENRICHED,
  ORDER_COMPLETED,
  ORDER_FAILED,
} from '../../src/domain/events';

describe('event creators', () => {
  const order = createOrder({
    tenantId: 'tenant-1',
    idempotencyKey: 'key-1',
    customer: { customerId: 'cust-1', email: 'a@b.com' },
    lineItems: [{ productId: 'p', quantity: 1, unitPrice: 100 }],
  });

  it('createOrderReceivedEvent has correct detail-type', () => {
    const evt = createOrderReceivedEvent(order);
    expect(evt['detail-type']).toBe(ORDER_RECEIVED);
    expect(evt.detail.orderId).toBe(order.orderId);
    expect(evt.detail.tenantId).toBe(order.tenantId);
    expect(evt.detail.idempotencyKey).toBe(order.idempotencyKey);
  });

  it('createOrderValidatedEvent has validatedAt in detail', () => {
    const evt = createOrderValidatedEvent({ ...order, validatedAt: new Date().toISOString() });
    expect(evt['detail-type']).toBe(ORDER_VALIDATED);
    expect(evt.detail.validatedAt).toBeTruthy();
  });

  it('createOrderEnrichedEvent has enrichedAt in detail', () => {
    const evt = createOrderEnrichedEvent({ ...order, enrichedAt: new Date().toISOString() });
    expect(evt['detail-type']).toBe(ORDER_ENRICHED);
    expect(evt.detail.enrichedAt).toBeTruthy();
  });

  it('createOrderCompletedEvent has completedAt in detail', () => {
    const evt = createOrderCompletedEvent({ ...order, completedAt: new Date().toISOString() });
    expect(evt['detail-type']).toBe(ORDER_COMPLETED);
    expect(evt.detail.completedAt).toBeTruthy();
  });

  it('createOrderFailedEvent includes reason', () => {
    const evt = createOrderFailedEvent({ ...order, failedAt: new Date().toISOString() }, 'customer email domain blocked');
    expect(evt['detail-type']).toBe(ORDER_FAILED);
    expect(evt.detail.reason).toBe('customer email domain blocked');
  });
});
