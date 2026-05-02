export enum OrderStatus {
  RECEIVED = 'received',
  VALIDATED = 'validated',
  ENRICHED = 'enriched',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface LineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Customer {
  customerId: string;
  email: string;
}

export interface Order {
  orderId: string;
  tenantId: string;
  customer: Customer;
  lineItems: LineItem[];
  status: OrderStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  validatedAt?: string;
  enrichedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export class InvalidStatusTransitionError extends Error {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot transition order from ${from} to ${to}`);
    this.name = 'InvalidStatusTransitionError';
    this.from = from;
    this.to = to;
  }
}

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.RECEIVED]: [OrderStatus.VALIDATED, OrderStatus.FAILED],
  [OrderStatus.VALIDATED]: [OrderStatus.ENRICHED, OrderStatus.FAILED],
  [OrderStatus.ENRICHED]: [OrderStatus.COMPLETED, OrderStatus.FAILED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.FAILED]: [],
};

export function createOrder(input: {
  tenantId: string;
  idempotencyKey: string;
  customer: Customer;
  lineItems: LineItem[];
  metadata?: Record<string, unknown>;
}): Order {
  const now = new Date().toISOString();
  return {
    orderId: crypto.randomUUID(),
    tenantId: input.tenantId,
    customer: input.customer,
    lineItems: input.lineItems,
    status: OrderStatus.RECEIVED,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata,
  };
}

export function updateOrderStatus(
  order: Order,
  newStatus: OrderStatus,
  extra?: { failureReason?: string },
): Order {
  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed.includes(newStatus)) {
    throw new InvalidStatusTransitionError(order.status, newStatus);
  }
  const updated: Order = { ...order, status: newStatus, updatedAt: new Date().toISOString() };
  if (newStatus === OrderStatus.VALIDATED) updated.validatedAt = updated.updatedAt;
  if (newStatus === OrderStatus.ENRICHED) updated.enrichedAt = updated.updatedAt;
  if (newStatus === OrderStatus.COMPLETED) updated.completedAt = updated.updatedAt;
  if (newStatus === OrderStatus.FAILED) {
    updated.failedAt = updated.updatedAt;
    if (extra?.failureReason) updated.failureReason = extra.failureReason;
  }
  return updated;
}
