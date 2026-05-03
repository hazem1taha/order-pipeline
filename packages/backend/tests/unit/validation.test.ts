import { validateOrderForIngestion, validateBusinessRules } from '../../src/domain/validation';
import { createOrder } from '../../src/domain/order';

describe('validateOrderForIngestion', () => {
  const validInput = {
    tenantId: 'tenant-1',
    idempotencyKey: 'key-1',
    customer: { customerId: 'cust-1', email: 'alice@example.com' },
    items: [{ productId: 'prod-1', quantity: 2, unitPrice: 1999 }],
  };

  it('returns valid for correct input', () => {
    expect(validateOrderForIngestion(validInput)).toEqual({ valid: true, errors: [] });
  });

  it('rejects missing tenantId', () => {
    const result = validateOrderForIngestion({ ...validInput, tenantId: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('tenantId'))).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = validateOrderForIngestion({ ...validInput, customer: { ...validInput.customer, email: 'not-an-email' } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('email'))).toBe(true);
  });

  it('rejects empty line items', () => {
    const result = validateOrderForIngestion({ ...validInput, items: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects zero quantity', () => {
    const result = validateOrderForIngestion({ ...validInput, items: [{ productId: 'p', quantity: 0, unitPrice: 100 }] });
    expect(result.valid).toBe(false);
  });

  it('rejects negative unitPrice', () => {
    const result = validateOrderForIngestion({ ...validInput, items: [{ productId: 'p', quantity: 1, unitPrice: -1 }] });
    expect(result.valid).toBe(false);
  });
});

describe('validateBusinessRules', () => {
  const makeOrder = (overrides: Partial<{ email: string; customerId: string; quantity: number; unitPrice: number }> = {}) =>
    createOrder({
      tenantId: 't',
      idempotencyKey: 'k',
      customer: { customerId: overrides.customerId ?? 'c', email: overrides.email ?? 'a@b.com' },
      lineItems: [{ productId: 'p', quantity: overrides.quantity ?? 1, unitPrice: overrides.unitPrice ?? 10 }],
    });

  it('returns valid for a well-formed order', () => {
    expect(validateBusinessRules(makeOrder())).toEqual({ valid: true, errors: [] });
  });

  it('rejects empty customerId', () => {
    const order = makeOrder({ customerId: '' });
    const result = validateBusinessRules(order);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid email', () => {
    const order = makeOrder({ email: 'not-email' });
    expect(validateBusinessRules(order).valid).toBe(false);
  });

  it('rejects zero quantity', () => {
    const order = makeOrder({ quantity: 0 });
    expect(validateBusinessRules(order).valid).toBe(false);
  });

  it('rejects negative unitPrice', () => {
    const order = makeOrder({ unitPrice: -1 });
    expect(validateBusinessRules(order).valid).toBe(false);
  });
});
