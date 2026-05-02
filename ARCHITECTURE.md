# Architecture

## Component responsibilities

**Ingestion Lambda (order-ingest)**
Accepts HTTP POST with an order payload, validates the shape with Zod, checks idempotency (GSI2 lookup), writes to DynamoDB with a conditional write to prevent races, publishes `order.received` to EventBridge, returns 201. If the idempotency key matches an existing non-failed order, returns 200 with the existing order — no duplicate processing.

**Validation Lambda (order-validation)**
Consumes from `order-validation-queue` (SQS event source mapping, batch size 1). Runs business rules: valid email format, non-empty customerId, at least one line item, all quantities > 0, all prices > 0. On failure: updates DynamoDB status to `failed` with `failureReason`, publishes `order.failed`. On success: updates status to `validated`, publishes `order.validated`. Does not swallow errors — throws so SQS retries and eventually sends to DLQ.

**Enrichment Lambda (order-enrichment)**
Consumes from `order-enrichment-queue`. Reads the order from DynamoDB, looks up each `productId` in a small mock product catalog (hash-based lookup). Adds `productName` and `category` to each line item. Writes enriched line items back to DynamoDB with status `enriched`. Publishes `order.enriched`.

**Completion Lambda (order-completion)**
Consumes from `order-completion-queue`. Performs the final state transition, marks the order `completed`, publishes `order.completed`.

**Query Lambda (order-query)**
HTTP GET /orders/{orderId} from API Gateway. Reads order from DynamoDB by PK (TENANT#{tenantId}) + SK (ORDER#{orderId}). Returns 200 with the order or 404 if not found. TenantId passed as query parameter.

**DLQ Monitor Lambda (order-dlq-monitor)**
Scheduled CloudWatch Events trigger (every 5 minutes). Receives messages from each of the three DLQs (up to 10 per queue per run). Logs each message at WARN level (or ERROR if message is older than 1 hour — HIGH severity). Deletes the message after logging. Does not throw — errors are logged, not rethrown, so the monitor itself doesn't go to a DLQ.

---

## Data flow

### DynamoDB item structure

```
Table: orders-{stage}
PK:  pk  = TENANT#{tenantId}
SK:  sk  = ORDER#{orderId}

GSI1 (query orders by status per tenant):
  GSI1PK = TENANT#{tenantId}#STATUS#{status}
  GSI1SK = createdAt (descending for recent-first)

GSI2 (idempotency lookup):
  GSI2PK = IDEMPOTENCY#{tenantId}#{idempotencyKey}
  GSI2SK = ORDER#{orderId}
```

Full access patterns:
1. **Write order** — PutItem with PK=TENANT#, SK=ORDER#, GSI1PK, GSI1SK, GSI2PK, GSI2SK
2. **Read order** — GetItem by PK + SK
3. **Update status** — UpdateItem by PK + SK, update status + timestamp + status-specific fields (validatedAt, enrichedAt, completedAt, failedAt + failureReason)
4. **Idempotency check** — Query GSI2 by GSI2PK=TENANT#IDEMPOTENCY#{idempotencyKey}, limit 1
5. **Query by status** — Query GSI1 by GSI1PK=TENANT#STATUS#{status}, scan descending

Billing: on-demand (PAY_PER_REQUEST). PITR enabled.

### EventBridge event envelope

```json
{
  "detail-type": "order.received",
  "source": "order-pipeline",
  "detail": {
    "orderId": "uuid",
    "tenantId": "tenant-123",
    "idempotencyKey": "idem-uuid",
    "timestamp": "2026-05-02T12:00:00.000Z"
  }
}
```

The `detail` object is serialized as a JSON string in `EventBridge.detail`. All events share the same envelope shape; the `detail-type` field discriminates the event type.

### SQS message shape

SQS delivers the EventBridge event as the message body. The Lambda receives:

```json
{
  "Records": [
    {
      "messageId": "...",
      "body": "{ \"detail-type\": \"order.received\", \"source\": \"order-pipeline\", \"detail\": { ... } }",
      "attributes": {
        "ApproximateReceiveCount": "1",
        "ApproximateFirstReceiveTimestamp": "..."
      }
    }
  ]
}
```

The Lambda parses `JSON.parse(record.body)`, extracts `detail.orderId` and `detail.tenantId`, and proceeds.

---

## Error handling taxonomy

Three classes of errors, handled differently:

**1. Validation errors (4xx)**
The caller's fault — malformed input, missing required fields, business rule violations. Return HTTP 400 with a clear error message. Do not retry. Do not enqueue. These are fast-fail cases.

**2. Transient errors (5xx)**
Downstream infrastructure is temporarily unavailable (DynamoDB throttling, EventBridge API flap). Throw the error — do not catch it. SQS retry policy (exponential backoff via `maxReceiveCount`) handles the retry. After max retries, message lands in DLQ. This is the correct behavior: we don't want to silently drop orders, and we don't want to return a 500 to the caller (who may have already retried on their end).

**3. Poison errors (unrecoverable)**
The message is malformed in a way that will never succeed regardless of retries (e.g., a bug in business logic that always throws). These get caught explicitly in the handler, logged with full context (orderId, tenantId, receipt handle, raw message), and re-thrown so SQS routes them to DLQ with a poison marker. In production, you'd extend this to send an SNS notification.

**DLQ re-drive**: when the underlying bug is fixed, DLQ messages can be manually re-driven by configuring the DLQ's redrive policy or by a Lambda that polls the DLQ and re-sends messages to the source queue.

---

## Idempotency implementation

The idempotency key is a UUID generated by the client and passed in the order payload. It's unique per tenant.

1. Client sends POST with `idempotencyKey: "idem-123"`
2. Ingestion Lambda queries GSI2 by `IDEMPOTENCY#{tenantId}#idem-123`
3. If a record exists and status != `failed`: return HTTP 200 with the existing order (idempotent replay, no-op)
4. If no record exists: `PutItem` with `ConditionExpression: attribute_not_exists(pk)`
   - If the condition fails (race between two concurrent inserts with the same key): return HTTP 409 Conflict
   - Otherwise: write succeeds, return HTTP 201 with new order

The `failed` status is treated as not idempotent — a client that receives a failure response should be able to retry with the same key and get a fresh attempt.

Idempotency window: 30 days (configurable via `IDEMPOTENCY_WINDOW_DAYS`). DynamoDB TTL on the idempotency records can enforce this automatically.

---

## Enrichment mock

The mock product catalog is a small in-memory `Map` in `enrich.ts`:

```typescript
const MOCK_PRODUCTS = {
  'prod-789': { name: 'Organic Protein Bar', category: 'nutrition' },
  'prod-001': { name: 'Energy Drink', category: 'beverages' },
  // ...
};
```

For each line item, the enrichment function looks up `productId`. If not found, it uses a fallback: `{ name: 'Product {productId}', category: 'general' }`. A real system would call an external product service with a circuit breaker.

---

## Observability

Structured JSON logging via a thin custom logger in `infra/logger.ts`. Every log entry includes:

- `timestamp` (ISO 8601)
- `level` (DEBUG / INFO / WARN / ERROR)
- `message` (human-readable)
- `correlationId` (per-invocation UUID, from Lambda context or generated)
- `orderId`, `tenantId` (when available in context)

CloudWatch log groups have 14-day retention (explicitly set — the default of "indefinite" is a real-world cost mistake that compounds quickly at scale).

One composite CloudWatch alarm fires when any of the three DLQ queues has messages. In production, this would route to SNS → PagerDuty.

No X-Ray is implemented — structured logging is the observability layer here. X-Ray would be the next step.

---

## IAM (least privilege)

Each Lambda function has its own IAM role. No role uses `Resource: "*"`. Scoping:

- `order-ingest`: DynamoDB (PutItem + Query by GSI2), EventBridge (PutEvents)
- `order-validation`: DynamoDB (GetItem + UpdateItem + Query by GSI2), EventBridge (PutEvents)
- `order-enrichment`: DynamoDB (GetItem + UpdateItem), EventBridge (PutEvents)
- `order-completion`: DynamoDB (GetItem + UpdateItem), EventBridge (PutEvents)
- `order-query`: DynamoDB (GetItem only)
- `order-dlq-monitor`: SQS (ReceiveMessage + DeleteMessage on each DLQ)

Production multi-tenancy would add condition keys to each DynamoDB policy to restrict access to only the tenant's own partition key values (`dynamodb:pk = 'TENANT#${context.tenantId}'`).
