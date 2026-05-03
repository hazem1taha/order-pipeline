import type { APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBOrdersRepository } from '../infra/orders-repository.js';
import { createAPIGatewayResponse } from '../lib/middleware.js';
import { OrderNotFoundError } from '../lib/errors.js';
import { withLambdaHandler } from '../lib/middleware.js';

const repo = new DynamoDBOrdersRepository();

async function handleQuery(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const orderId = event.pathParameters?.orderId;
  const tenantId = (event.queryStringParameters?.tenantId as string) || (event.headers?.tenantid as string);

  if (!orderId) {
    return createAPIGatewayResponse(400, { error: 'Missing orderId' });
  }
  if (!tenantId) {
    return createAPIGatewayResponse(400, { error: 'Missing tenantId' });
  }

  const order = await repo.get(tenantId, orderId);
  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  return createAPIGatewayResponse(200, order);
}

export const queryHandler = withLambdaHandler(handleQuery);
