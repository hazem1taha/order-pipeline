export const ORDER_RECEIVED = 'order.received';
export const ORDER_VALIDATED = 'order.validated';
export const ORDER_ENRICHED = 'order.enriched';
export const ORDER_COMPLETED = 'order.completed';
export const ORDER_FAILED = 'order.failed';

export interface OrderReceivedEvent {
  'detail-type': string;
  source: string;
  detail: {
    orderId: string;
    tenantId: string;
    idempotencyKey: string;
    timestamp: string;
  };
}

export interface OrderValidatedEvent {
  'detail-type': string;
  source: string;
  detail: {
    orderId: string;
    tenantId: string;
    timestamp: string;
    validatedAt: string;
  };
}

export interface OrderEnrichedEvent {
  'detail-type': string;
  source: string;
  detail: {
    orderId: string;
    tenantId: string;
    timestamp: string;
    enrichedAt: string;
  };
}

export interface OrderCompletedEvent {
  'detail-type': string;
  source: string;
  detail: {
    orderId: string;
    tenantId: string;
    timestamp: string;
    completedAt: string;
  };
}

export interface OrderFailedEvent {
  'detail-type': string;
  source: string;
  detail: {
    orderId: string;
    tenantId: string;
    timestamp: string;
    failedAt: string;
    reason: string;
  };
}

import type { Order } from './order.js';

export function createOrderReceivedEvent(order: Order): OrderReceivedEvent {
  const timestamp = new Date().toISOString();
  return {
    'detail-type': ORDER_RECEIVED,
    source: 'order-pipeline',
    detail: {
      orderId: order.orderId,
      tenantId: order.tenantId,
      idempotencyKey: order.idempotencyKey,
      timestamp,
    },
  };
}

export function createOrderValidatedEvent(order: Order): OrderValidatedEvent {
  const timestamp = new Date().toISOString();
  return {
    'detail-type': ORDER_VALIDATED,
    source: 'order-pipeline',
    detail: {
      orderId: order.orderId,
      tenantId: order.tenantId,
      timestamp,
      validatedAt: order.validatedAt ?? timestamp,
    },
  };
}

export function createOrderEnrichedEvent(order: Order): OrderEnrichedEvent {
  const timestamp = new Date().toISOString();
  return {
    'detail-type': ORDER_ENRICHED,
    source: 'order-pipeline',
    detail: {
      orderId: order.orderId,
      tenantId: order.tenantId,
      timestamp,
      enrichedAt: order.enrichedAt ?? timestamp,
    },
  };
}

export function createOrderCompletedEvent(order: Order): OrderCompletedEvent {
  const timestamp = new Date().toISOString();
  return {
    'detail-type': ORDER_COMPLETED,
    source: 'order-pipeline',
    detail: {
      orderId: order.orderId,
      tenantId: order.tenantId,
      timestamp,
      completedAt: order.completedAt ?? timestamp,
    },
  };
}

export function createOrderFailedEvent(order: Order, reason: string): OrderFailedEvent {
  const timestamp = new Date().toISOString();
  return {
    'detail-type': ORDER_FAILED,
    source: 'order-pipeline',
    detail: {
      orderId: order.orderId,
      tenantId: order.tenantId,
      timestamp,
      failedAt: order.failedAt ?? timestamp,
      reason,
    },
  };
}
