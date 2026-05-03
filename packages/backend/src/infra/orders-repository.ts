import {
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config.js';
import type { Order } from '../domain/order.js';

export interface OrdersRepository {
  put(order: Order): Promise<void>;
  get(tenantId: string, orderId: string): Promise<Order | null>;
  updateStatus(
    tenantId: string,
    orderId: string,
    status: string,
    extra?: Record<string, unknown>,
  ): Promise<void>;
  findByIdempotencyKey(tenantId: string, key: string): Promise<Order | null>;
  findByStatus(tenantId: string, status: string, limit?: number): Promise<Order[]>;
}

function buildDocClient(): DynamoDBDocumentClient {
  const clientConfig: { region: string; endpoint?: string } = {
    region: config.AWS_REGION,
  };
  if (config.LOCALSTACK_URL) {
    clientConfig.endpoint = config.LOCALSTACK_URL;
  }
  const client = new DynamoDBClient(clientConfig);
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

const doc = buildDocClient();
const TABLE = config.DYNAMODB_TABLE_NAME;

function pk(tenantId: string) { return `TENANT#${tenantId}`; }
function sk(orderId: string) { return `ORDER#${orderId}`; }

export class DynamoDBOrdersRepository implements OrdersRepository {
  async put(order: Order): Promise<void> {
    await doc.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: pk(order.tenantId),
          sk: sk(order.orderId),
          gsi1pk: `TENANT#${order.tenantId}#STATUS#${order.status}`,
          gsi1sk: order.createdAt,
          gsi2pk: `IDEMPOTENCY#${order.tenantId}#${order.idempotencyKey}`,
          gsi2sk: sk(order.orderId),
          ...order,
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
  }

  async get(tenantId: string, orderId: string): Promise<Order | null> {
    const result = await doc.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: pk(tenantId), sk: sk(orderId) },
      }),
    );
    return (result.Item as Order) ?? null;
  }

  async updateStatus(
    tenantId: string,
    orderId: string,
    status: string,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status,
      updatedAt: now,
      gsi1pk: `TENANT#${tenantId}#STATUS#${status}`,
    };
    if (status === 'validated') updates.validatedAt = now;
    if (status === 'enriched') updates.enrichedAt = now;
    if (status === 'completed') updates.completedAt = now;
    if (status === 'failed') {
      updates.failedAt = now;
      if (extra?.failureReason) updates.failureReason = extra.failureReason;
    }
    if (extra && 'lineItems' in extra) updates.lineItems = extra.lineItems;

    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { pk: pk(tenantId), sk: sk(orderId) },
        UpdateExpression:
          'SET ' +
          Object.keys(updates)
            .map((k) => `#${k} = :${k}`)
            .join(', '),
        ExpressionAttributeNames: Object.fromEntries(
          Object.keys(updates).map((k) => [`#${k}`, k]),
        ),
        ExpressionAttributeValues: Object.fromEntries(
          Object.entries(updates).map(([k, v]) => [`:${k}`, v]),
        ),
      }),
    );
  }

  async findByIdempotencyKey(tenantId: string, key: string): Promise<Order | null> {
    const result = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI2',
        KeyConditionExpression: 'gsi2pk = :pk',
        ExpressionAttributeValues: { ':pk': `IDEMPOTENCY#${tenantId}#${key}` },
        Limit: 1,
      }),
    );
    const item = result.Items?.[0] as Order | undefined;
    return item ?? null;
  }

  async findByStatus(
    tenantId: string,
    status: string,
    limit = 20,
  ): Promise<Order[]> {
    const result = await doc.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}#STATUS#${status}`,
        },
        Limit: limit,
        ScanIndexForward: false,
      }),
    );
    return (result.Items as Order[]) ?? [];
  }
}
