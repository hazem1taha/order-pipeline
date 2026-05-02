import { DynamoDBOrdersRepository } from '../../src/infra/orders-repository';
import { createOrder, OrderStatus } from '../../src/domain/order';
import { config } from '../../src/config';

const SKIP_INTEGRATION = !config.DYNAMODB_TABLE_NAME;

const repo = new DynamoDBOrdersRepository();

describe('DynamoDBOrdersRepository (integration)', () => {
  beforeAll(async () => {
    if (SKIP_INTEGRATION) {
      console.warn('Skipping integration tests — DYNAMODB_TABLE_NAME not set');
    }
  });

  const tenantId = 'test-tenant-' + Date.now();
  const customer = { customerId: 'test-cust', email: 'test@example.com' };
  const lineItems = [{ productId: 'test-prod', quantity: 2, unitPrice: 999 }];

  it('puts and gets an order', async () => {
    if (SKIP_INTEGRATION) return;
    const order = createOrder({ tenantId, idempotencyKey: 'key-' + Date.now(), customer, lineItems });
    await repo.put(order);
    const retrieved = await repo.get(tenantId, order.orderId);
    expect(retrieved?.orderId).toBe(order.orderId);
    expect(retrieved?.status).toBe(OrderStatus.RECEIVED);
  });

  it('finds an order by idempotency key', async () => {
    if (SKIP_INTEGRATION) return;
    const key = 'idem-' + Date.now();
    const order = createOrder({ tenantId, idempotencyKey: key, customer, lineItems });
    await repo.put(order);
    const found = await repo.findByIdempotencyKey(tenantId, key);
    expect(found?.orderId).toBe(order.orderId);
  });

  it('updates order status', async () => {
    if (SKIP_INTEGRATION) return;
    const order = createOrder({ tenantId, idempotencyKey: 'key2-' + Date.now(), customer, lineItems });
    await repo.put(order);
    await repo.updateStatus(tenantId, order.orderId, OrderStatus.VALIDATED);
    const updated = await repo.get(tenantId, order.orderId);
    expect(updated?.status).toBe(OrderStatus.VALIDATED);
    expect(updated?.validatedAt).toBeTruthy();
  });

  it('finds orders by status using GSI1', async () => {
    if (SKIP_INTEGRATION) return;
    const key = 'key3-' + Date.now();
    const order = createOrder({ tenantId, idempotencyKey: key, customer, lineItems });
    await repo.put(order);
    await repo.updateStatus(tenantId, order.orderId, OrderStatus.VALIDATED);
    const found = await repo.findByStatus(tenantId, OrderStatus.VALIDATED, 10);
    expect(found.some(o => o.orderId === order.orderId)).toBe(true);
  });
});
