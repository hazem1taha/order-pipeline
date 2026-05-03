import { createOrder, updateOrderStatus, InvalidStatusTransitionError, OrderStatus } from '../../src/domain/order';

describe('createOrder', () => {
  it('generates a UUID and sets RECEIVED status', () => {
    const order = createOrder({
      tenantId: 'tenant-1',
      idempotencyKey: 'idem-1',
      customer: { customerId: 'cust-1', email: 'a@b.com' },
      lineItems: [{ productId: 'p-1', quantity: 2, unitPrice: 100 }],
    });
    expect(order.orderId).toBeTruthy();
    expect(order.status).toBe(OrderStatus.RECEIVED);
    expect(order.createdAt).toBeTruthy();
    expect(order.updatedAt).toBeTruthy();
  });

  it('accepts optional metadata', () => {
    const order = createOrder({
      tenantId: 'tenant-1',
      idempotencyKey: 'idem-1',
      customer: { customerId: 'cust-1', email: 'a@b.com' },
      lineItems: [{ productId: 'p-1', quantity: 1, unitPrice: 50 }],
      metadata: { source: 'web' },
    });
    expect(order.metadata).toEqual({ source: 'web' });
  });
});

describe('updateOrderStatus', () => {
  it('transitions RECEIVED to VALIDATED', () => {
    const order = createOrder({
      tenantId: 't', idempotencyKey: 'k', customer: { customerId: 'c', email: 'x@y.com' },
      lineItems: [{ productId: 'p', quantity: 1, unitPrice: 10 }],
    });
    const next = updateOrderStatus(order, OrderStatus.VALIDATED);
    expect(next.status).toBe(OrderStatus.VALIDATED);
    expect(next.validatedAt).toBeTruthy();
  });

  it('transitions VALIDATED to ENRICHED', () => {
    const order = createOrder({ tenantId: 't', idempotencyKey: 'k', customer: { customerId: 'c', email: 'x@y.com' }, lineItems: [{ productId: 'p', quantity: 1, unitPrice: 10 }] });
    const v = updateOrderStatus(order, OrderStatus.VALIDATED);
    const e = updateOrderStatus(v, OrderStatus.ENRICHED);
    expect(e.status).toBe(OrderStatus.ENRICHED);
    expect(e.enrichedAt).toBeTruthy();
  });

  it('throws on invalid transition RECEIVED -> COMPLETED', () => {
    const order = createOrder({ tenantId: 't', idempotencyKey: 'k', customer: { customerId: 'c', email: 'x@y.com' }, lineItems: [{ productId: 'p', quantity: 1, unitPrice: 10 }] });
    expect(() => updateOrderStatus(order, OrderStatus.COMPLETED)).toThrow(InvalidStatusTransitionError);
  });

  it('throws on invalid transition COMPLETED -> VALIDATED', () => {
    const order = createOrder({ tenantId: 't', idempotencyKey: 'k', customer: { customerId: 'c', email: 'x@y.com' }, lineItems: [{ productId: 'p', quantity: 1, unitPrice: 10 }] });
    const c = updateOrderStatus(updateOrderStatus(order, OrderStatus.VALIDATED), OrderStatus.ENRICHED);
    const comp = updateOrderStatus(c, OrderStatus.COMPLETED);
    expect(() => updateOrderStatus(comp, OrderStatus.VALIDATED)).toThrow(InvalidStatusTransitionError);
  });

  it('sets failureReason on FAILED transition', () => {
    const order = createOrder({ tenantId: 't', idempotencyKey: 'k', customer: { customerId: 'c', email: 'x@y.com' }, lineItems: [{ productId: 'p', quantity: 1, unitPrice: 10 }] });
    const f = updateOrderStatus(order, OrderStatus.FAILED, { failureReason: 'bad email' });
    expect(f.status).toBe(OrderStatus.FAILED);
    expect(f.failureReason).toBe('bad email');
    expect(f.failedAt).toBeTruthy();
  });
});
