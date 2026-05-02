# Order Ingestion Pipeline

A serverless event-driven order ingestion pipeline on AWS. Lambda functions process incoming orders through a validation → enrichment → completion state machine, with EventBridge as the event bus and SQS queues handling async processing. DynamoDB single-table design. React frontend for manual testing.

---

## Architecture at a glance

```
Client (HTTP POST)
  └─→ API Gateway
       └─→ Ingestion Lambda
            ├─→ DynamoDB (write, status='received')
            └─→ EventBridge (order.received)
                 ├─→ Rule → order-validation-queue
                 │    └─→ Validation Lambda
                 │         ├─→ DynamoDB (status='validated')
                 │         └─→ EventBridge (order.validated)
                 │              └─→ Rule → order-enrichment-queue
                 │                   └─→ Enrichment Lambda
                 │                        ├─→ DynamoDB (status='enriched', enriched lineItems)
                 │                        └─→ EventBridge (order.enriched)
                 │                             └─→ Rule → order-completion-queue
                 │                                  └─→ Completion Lambda
                 │                                       └─→ DynamoDB (status='completed')
  └─→ Query Lambda ← DynamoDB (read)
```

Every SQS queue has a DLQ. Failed messages land there with full context, not in a black hole.

---

## Why this exists

I built this as a reference implementation of the patterns I use in production for high-volume event-driven systems. It's a portfolio project, not a SaaS. The code is honest about its scope — no pretending it's production-ready, but every piece is production-shaped.

---

## What this demonstrates

- Event-driven architecture with EventBridge + SQS + DLQs
- Idempotent message processing (conditional DynamoDB write + replay detection)
- Single-table DynamoDB modeling (two GSIs: status queries, idempotency lookup)
- Multi-tenant data design (all access paths scoped to TENANT#{tenantId})
- Least-privilege IAM (per-function roles, no `Resource: "*"` in policies)
- Structured JSON observability (correlation IDs, per-request logging)
- Local dev parity via LocalStack (same services locally as in AWS)

---

## Quick start

```bash
git clone git@github.com:hazem1taha/order-pipeline.git
cd order-pipeline
pnpm install
./scripts/localstack-up.sh
./scripts/seed-localstack.sh
pnpm --filter frontend dev
# Visit http://localhost:5173
```

Teardown:
```bash
./scripts/localstack-down.sh
```

---

## Architecture

An order arrives via HTTP POST to API Gateway. The Ingestion Lambda validates the request shape, checks for a duplicate idempotency key (returns existing order if found), writes to DynamoDB with status `received`, and publishes an `order.received` event to the EventBridge bus.

EventBridge rules fan out from the bus to three SQS queues. The Validation Lambda consumes from `order-validation-queue`. It runs business rules (email format, positive quantities, non-empty line items). If validation fails, the order is marked `failed` with a reason and a `order.failed` event is published. If it passes, status becomes `validated` and an `order.validated` event is published.

The Enrichment Lambda consumes from `order-enrichment-queue`. It enriches line items with product metadata (a mock external API — hash-based lookup from a small catalog). The enriched order is written back to DynamoDB with status `enriched`.

The Completion Lambda consumes from `order-completion-queue`. It performs the final state transition, marking the order `completed`.

Query Lambda (HTTP GET /orders/{orderId}) reads directly from DynamoDB.

The DLQ Monitor runs every 5 minutes, inspects each DLQ, logs any messages older than 1 hour at HIGH severity.

---

## Design decisions

**Why EventBridge instead of direct SQS-to-SQS chaining**
SQS chains work but EventBridge gives you a centralized bus, schema enforcement, and the ability to add new consumers without touching the producers. You can also replay events from the bus history in EventBridge (if you enable archiving). At low volume the cost is the same. The decoupling is worth it.

**Why DynamoDB single-table with two GSIs**
Single-table avoids the operational overhead of multiple tables while keeping access patterns fast. GSI1 handles "query orders by status for a tenant" (needed for the frontend polling). GSI2 handles idempotency key lookups. One table, two indexes, same cost as one. The alternative (separate orders + idempotency tables) adds joins, more IAM permissions, and more operational surface.

**Why idempotency keys are non-negotiable**
In any ingestion system that retries — and all of them do — duplicate orders are a real business problem. HTTP clients retry, Lambda invocations can be retried by the runtime, SQS delivers at-least-once. Without idempotency keys, retries create duplicates and you charge customers twice. With idempotency keys (checked before write via GSI2 + conditional PutItem), retries become no-ops. Cost: one extra DynamoDB query per ingest. Benefit: correctness.

**Why no HTTP framework on the Lambdas**
Express/Fastify add a dependency surface and a cold start penalty. Lambda's HTTP request/response shape is simple enough to handle with a thin middleware wrapper. This also signals that I understand the primitives rather than cargo-culting a framework.

**Why arm64 / Graviton3**
Graviton3 instances are about 20% cheaper and have better performance-per-watt than x86. The trade-off is marginal at portfolio scale, but it's the right default for new work and it's what you'd use in production.

**What I'd add for production**
- KMS-per-tenant encryption for DynamoDB (row-level isolation)
- Fine-grained IAM with tenant-scoped policies
- X-Ray distributed tracing (instead of just structured logs)
- DLQ alarms → SNS → PagerDuty instead of just CloudWatch log inspection
- Blue/green deployments via serverless-deploy with traffic shifting
- Real product catalog (external service call with circuit breaker)
- Auth on API Gateway (Cognito or JWT) — intentionally out of scope here

---

## Trade-offs and what's not here

This is deliberately a single-region, single-tenant-design, unauthenticated reference implementation. Here's what's intentionally absent:

- **Auth**: API Gateway has no auth. In production, you'd add Cognito or JWT validation.
- **Real payment processing**: Orders have line items with prices; no payment is captured or charged.
- **Real product catalog**: Enrichment uses a mock in-memory catalog. A real system calls an external API with a circuit breaker.
- **Advanced multi-tenancy isolation**: Data model is tenant-scoped. IAM and encryption are not tenant-isolated. That's a layer beyond this scope.
- **X-Ray / custom metrics**: Structured logs are implemented; distributed tracing is not.
- **Blue/green or canary deploys**: Serverless Framework's default all-at-once deploy is used.
- **Multi-region**: The architecture supports it; the implementation doesn't.

If you're evaluating this for production use, these are the first five things I'd add.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20.x, TypeScript 5 (strict), AWS SDK v3 (modular) |
| IaC | Serverless Framework v3 |
| Database | DynamoDB (single-table, on-demand) |
| Messaging | EventBridge (custom bus) + SQS (with DLQs) |
| Frontend | React 18, Vite, TanStack Query, Tailwind CSS, Zod |
| Testing | Jest + aws-sdk-client-mock (unit), LocalStack (integration) |
| CI | GitHub Actions |

---

## Repository structure

```
serverless-order-pipeline/
├── README.md
├── ARCHITECTURE.md
├── LICENSE
├── CHANGELOG.md
├── docker-compose.yml
├── .env.example
├── packages/
│   ├── backend/
│   │   ├── serverless.yml
│   │   ├── src/
│   │   │   ├── config.ts
│   │   │   ├── domain/         # Pure domain logic, no AWS imports
│   │   │   │   ├── order.ts
│   │   │   │   ├── events.ts
│   │   │   │   └── validation.ts
│   │   │   ├── infra/          # AWS SDK wrappers
│   │   │   │   ├── orders-repository.ts
│   │   │   │   ├── event-publisher.ts
│   │   │   │   └── logger.ts
│   │   │   ├── lib/
│   │   │   │   ├── errors.ts
│   │   │   │   └── middleware.ts
│   │   │   └── handlers/       # Lambda handlers
│   │   │       ├── ingest.ts
│   │   │       ├── validate.ts
│   │   │       ├── enrich.ts
│   │   │       ├── complete.ts
│   │   │       ├── query.ts
│   │   │       └── dlq-monitor.ts
│   │   └── tests/
│   └── frontend/
│       ├── src/
│       │   ├── App.tsx
│       │   ├── api/client.ts
│       │   └── components/
│       └── package.json
├── scripts/
│   ├── localstack-up.sh
│   ├── localstack-down.sh
│   └── seed-localstack.sh
└── .github/workflows/ci.yml
```

---

## Running tests

```bash
# Unit tests (< 5 seconds)
pnpm -r test:unit

# Integration tests (requires LocalStack)
docker-compose up -d && ./scripts/seed-localstack.sh
pnpm -r test:integration
```

## Deploying to AWS

```bash
pnpm run deploy --stage dev
# Tear down:
pnpm run remove --stage dev
```

Rough cost at portfolio-demo traffic: **$1–3/month** (Lambda invocations + DynamoDB write + EventBridge put events + API Gateway requests). Most of that is DynamoDB + API Gateway at zero/low traffic.

---

## License

MIT — see [LICENSE](./LICENSE)
