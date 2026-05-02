export const sampleReceivedEvent = {
  'detail-type': 'order.received',
  source: 'order-pipeline',
  detail: {
    orderId: 'order-uuid-001',
    tenantId: 'tenant-123',
    idempotencyKey: 'idem-abc-001',
    timestamp: '2026-05-02T12:00:00.000Z',
  },
};

export const sampleValidatedEvent = {
  'detail-type': 'order.validated',
  source: 'order-pipeline',
  detail: {
    orderId: 'order-uuid-001',
    tenantId: 'tenant-123',
    timestamp: '2026-05-02T12:00:01.000Z',
    validatedAt: '2026-05-02T12:00:01.000Z',
  },
};

export const sampleFailedEvent = {
  'detail-type': 'order.failed',
  source: 'order-pipeline',
  detail: {
    orderId: 'order-uuid-001',
    tenantId: 'tenant-123',
    timestamp: '2026-05-02T12:00:01.000Z',
    failedAt: '2026-05-02T12:00:01.000Z',
    reason: 'customer email domain blocked',
  },
};
