import type { Order } from './order.js';
import { z } from 'zod';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const CustomerSchema = z.object({
  customerId: z.string().min(1, 'customerId is required'),
  email: z.string().email('invalid email format'),
});

const LineItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z.number().int().positive('quantity must be a positive integer'),
  unitPrice: z.number().positive('unitPrice must be positive'),
});

const OrderIngestionSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  customer: CustomerSchema,
  items: z.array(LineItemSchema).min(1, 'at least one line item is required'),
  metadata: z.record(z.unknown()).optional(),
});

export function validateOrderForIngestion(input: unknown): ValidationResult {
  const result = OrderIngestionSchema.safeParse(input);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }
  return { valid: true, errors: [] };
}

export function validateBusinessRules(order: Order): ValidationResult {
  const errors: string[] = [];

  if (!order.customer.customerId) {
    errors.push('customerId must be non-empty');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(order.customer.email)) {
    errors.push('customer email must be a valid email address');
  }

  if (!order.lineItems || order.lineItems.length === 0) {
    errors.push('order must have at least one line item');
  } else {
    order.lineItems.forEach((item, i) => {
      if (item.quantity <= 0) {
        errors.push(`lineItems[${i}].quantity must be > 0`);
      }
      if (item.unitPrice <= 0) {
        errors.push(`lineItems[${i}].unitPrice must be > 0`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
