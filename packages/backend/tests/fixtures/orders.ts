export const validOrderInput = {
  tenantId: 'tenant-123',
  idempotencyKey: 'idem-abc-001',
  customer: { customerId: 'cust-456', email: 'alice@example.com' },
  items: [
    { productId: 'prod-789', quantity: 2, unitPrice: 1999 },
    { productId: 'prod-001', quantity: 1, unitPrice: 499 },
  ],
  metadata: { source: 'web', userAgent: 'Mozilla/5.0' },
};

export const invalidOrderInputs = {
  missingTenantId: { ...validOrderInput, tenantId: '' },
  missingIdempotencyKey: { ...validOrderInput, idempotencyKey: '' },
  badEmail: { ...validOrderInput, customer: { ...validOrderInput.customer, email: 'not-an-email' } },
  emptyItems: { ...validOrderInput, items: [] },
  zeroQuantity: { ...validOrderInput, items: [{ productId: 'p', quantity: 0, unitPrice: 100 }] },
  negativePrice: { ...validOrderInput, items: [{ productId: 'p', quantity: 1, unitPrice: -50 }] },
};
