import type { APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '../infra/logger.js';
import { OrderValidationError } from './errors.js';

export interface LambdaContext {
  requestId: string;
  tenantId?: string;
  orderId?: string;
}

type HandlerFn<TIn, TResult> = (event: TIn, ctx: LambdaContext) => Promise<TResult>;

export function withLambdaHandler<TEvent>(
  handler: HandlerFn<TEvent, APIGatewayProxyResult | void>,
  options?: { isSQS?: boolean },
) {
  return async (event: TEvent, context: { requestId: string }): Promise<APIGatewayProxyResult | void> => {
    const logger = createLogger({ correlationId: context.requestId });
    try {
      const ctx: LambdaContext = { requestId: context.requestId };
      return await handler(event, ctx);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Unhandled error', { error: error.message, stack: error.stack });
      if (options?.isSQS) {
        throw error;
      }
      const statusCode =
        error instanceof OrderValidationError ? error.statusCode : 500;
      const body =
        error instanceof OrderValidationError
          ? error.toJSON()
          : { error: 'InternalError', message: error.message, statusCode: 500 };
      return {
        statusCode,
        body: JSON.stringify(body),
      } as APIGatewayProxyResult;
    }
  };
}

export function createAPIGatewayResponse(
  statusCode: number,
  body: unknown,
): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  };
}

export function parseJSON(body: string | null | undefined): unknown {
  if (!body) throw new OrderValidationError(['request body is required']);
  try {
    return JSON.parse(body);
  } catch {
    throw new OrderValidationError(['invalid JSON in request body']);
  }
}
