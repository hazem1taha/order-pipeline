export class OrderNotFoundError extends Error {
  override readonly name = 'OrderNotFoundError';
  readonly statusCode = 404;
  constructor(orderId: string) {
    super(`Order ${orderId} not found`);
  }
  toJSON() {
    return { error: this.name, message: this.message, statusCode: this.statusCode };
  }
}

export class OrderValidationError extends Error {
  override readonly name = 'OrderValidationError';
  readonly statusCode = 400;
  readonly errors: string[];
  constructor(errors: string[]) {
    super(errors.join('; '));
    this.errors = errors;
  }
  toJSON() {
    return { error: this.name, message: this.message, statusCode: this.statusCode, errors: this.errors };
  }
}

export class IdempotencyConflictError extends Error {
  override readonly name = 'IdempotencyConflictError';
  readonly statusCode = 409;
  readonly existingOrder: unknown;
  constructor(existingOrder: unknown) {
    super('Duplicate idempotency key detected');
    this.existingOrder = existingOrder;
  }
  toJSON() {
    return { error: this.name, message: this.message, statusCode: this.statusCode };
  }
}

export class TransientError extends Error {
  override readonly name = 'TransientError';
  readonly statusCode = 500;
  constructor(message: string) {
    super(message);
  }
  toJSON() {
    return { error: this.name, message: this.message, statusCode: this.statusCode };
  }
}

export class InfrastructureError extends Error {
  override readonly name = 'InfrastructureError';
  readonly statusCode = 500;
  constructor(message: string) {
    super(message);
  }
  toJSON() {
    return { error: this.name, message: this.message, statusCode: this.statusCode };
  }
}
