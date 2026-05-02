import {
  OrderNotFoundError,
  OrderValidationError,
  IdempotencyConflictError,
  TransientError,
  InfrastructureError,
} from '../../src/lib/errors';

describe('OrderNotFoundError', () => {
  const err = new OrderNotFoundError('order-123');
  it('has name', () => expect(err.name).toBe('OrderNotFoundError'));
  it('has statusCode 404', () => expect(err.statusCode).toBe(404));
  it('has message', () => expect(err.message).toContain('order-123'));
  it('toJSON includes error and statusCode', () => {
    const json = err.toJSON();
    expect(json.error).toBe('OrderNotFoundError');
    expect(json.statusCode).toBe(404);
  });
});

describe('OrderValidationError', () => {
  const err = new OrderValidationError(['email invalid', 'quantity must be > 0']);
  it('has name', () => expect(err.name).toBe('OrderValidationError'));
  it('has statusCode 400', () => expect(err.statusCode).toBe(400));
  it('stores errors array', () => expect(err.errors).toHaveLength(2));
  it('toJSON includes errors', () => {
    const json = err.toJSON();
    expect(json.errors).toContain('email invalid');
  });
});

describe('IdempotencyConflictError', () => {
  const existing = { orderId: 'o1' };
  const err = new IdempotencyConflictError(existing);
  it('has name', () => expect(err.name).toBe('IdempotencyConflictError'));
  it('has statusCode 409', () => expect(err.statusCode).toBe(409));
  it('stores existingOrder', () => expect(err.existingOrder).toEqual(existing));
});

describe('TransientError', () => {
  const err = new TransientError('DynamoDB temporarily unavailable');
  it('has name', () => expect(err.name).toBe('TransientError'));
  it('has statusCode 500', () => expect(err.statusCode).toBe(500));
});

describe('InfrastructureError', () => {
  const err = new InfrastructureError('EventBridge PutEvents failed');
  it('has name', () => expect(err.name).toBe('InfrastructureError'));
  it('has statusCode 500', () => expect(err.statusCode).toBe(500));
});
