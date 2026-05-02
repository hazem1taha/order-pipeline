# Architectural Decision Records

Short, honest records of the trade-offs I made and why.

---

## ADR-001: Single EventBridge Bus vs Per-Tenant Buses

**Context**: The pipeline is multi-tenant. You could run one EventBridge bus per tenant (stronger isolation) or share a single bus across all tenants (simpler, cheaper).

**Decision**: Single bus, `tenantId` in the event detail.

**Consequences**: All tenants' events flow through the same bus. EventBridge rules route based on `detail-type` only — not `tenantId`. This means one misbehaving tenant can't affect routing for others (rules are based on event type, not tenant), but an EventBridge outage affects all tenants simultaneously. At portfolio-demo scale, a single bus is the right call. Per-tenant buses add operational overhead without meaningful benefit at this traffic level.

For production at scale, I'd consider per-tenant buses only after demonstrating tenant-level isolation requirements from the business side.

---

## ADR-002: Serverless Framework v3 vs CDK

**Context**: IaC choice. CDK offers programming-language-level flexibility. Serverless Framework is simpler for Lambda + SQS + EventBridge stacks.

**Decision**: Serverless Framework v3.

**Consequences**: Serverless Framework has a lower conceptual overhead for this specific stack. The `serverless.yml` is readable by anyone on the team without knowing TypeScript. CDK would let me express the infrastructure as code more precisely, but for a reference implementation, the simplicity wins. The trade-off: CDK's `new CfnInclude()` would let me manage existing CloudFormation resources — Serverless Framework doesn't have that. If the project grows to require complex custom resources, CDK would be the migration path.

I documented this choice honestly: CDK is better for complex infrastructure, Serverless Framework is better for this class of problem.

---

## ADR-003: SQS Queues vs SNS Topics for Order Processing

**Context**: EventBridge can route to either SQS queues (point-to-point) or SNS topics (fan-out). You could use SNS + SQS subscriptions for the fan-out pattern.

**Decision**: SQS queues throughout.

**Consequences**: SQS queues are simpler for sequential processing stages where each message is consumed by exactly one consumer. SNS makes sense when you want multiple consumers for the same event (e.g., one consumer for analytics, another for notifications, another for the main pipeline). Our pipeline is sequential, not fan-out, so SQS is the right primitive. If we later needed analytics on `order.completed` events, we'd add an SNS topic and subscribe both the completion processor and the analytics consumer to it.

---

## ADR-004: Idempotency GSI vs Write-If-Not-Exists

**Context**: Idempotency can be implemented as a conditional write (no record with the same PK exists) or as a separate lookup via a GSI.

**Decision**: GSI2 lookup first (check for existing idempotency key), then conditional write with `ConditionExpression: attribute_not_exists(pk)`.

**Consequences**: The GSI2 lookup lets us return an existing order on replay (good for retries from clients). The conditional write prevents race conditions where two requests with the same idempotency key arrive simultaneously — one writes, the other's condition fails, and we return 409. Combined, these two mechanisms give us idempotency that handles both client retries and concurrent requests. The cost is one extra DynamoDB query per ingest.

---

## ADR-005: arm64 / Graviton3 for Lambda

**Context**: Lambda supports x86_64 and arm64 (Graviton3) runtimes.

**Decision**: arm64 throughout.

**Consequences**: Graviton3 instances are about 20% cheaper per invocation and have better performance-per-watt. The trade-off: some third-party Lambda layers don't yet publish arm64 builds (rare, and mostly legacy). For a greenfield project, Graviton3 is the right default. I call this out explicitly in the README because most portfolio projects don't — it's a signal that I know the cost implications of my infrastructure choices.

---

## ADR-006: No HTTP Framework on Lambda Handlers

**Context**: Express or Fastify are commonly added to Lambda projects to handle routing, middleware, and request parsing.

**Decision**: Raw Lambda handlers with a thin custom middleware wrapper.

**Consequences**: No cold start penalty from framework initialization. No transitive dependency risk. The request/response shape is simple enough that a 30-line middleware module handles parsing, correlation ID injection, structured error handling, and JSON serialization without the weight of Express. The trade-off is that routing is handled by API Gateway (which is fine for the two endpoints we have), and we'd need to add a router if the API grew complex. For a reference implementation, the primitives are sufficient.

---

## ADR-007: Jest + aws-sdk-client-mock vs Vitest

**Context**: Testing framework choice.

**Decision**: Jest + aws-sdk-client-mock for unit tests.

**Consequences**: Jest is what most AWS + TypeScript projects use, so it's the safe choice for a portfolio. `aws-sdk-client-mock` makes it clean to mock AWS SDK calls without needing to actually call AWS. Vitest would be faster and has better ESM support, but the interoperability with `aws-sdk-client-mock` (which is Jest-centric) makes Jest the pragmatic choice here. Integration tests run against LocalStack with real SDK clients.

---
