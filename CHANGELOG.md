# Changelog

All notable changes will be documented in this file.

## [0.1.0] - 2026-05-02

### Added
- Initial release
- Event-driven order ingestion pipeline (serverless)
- Domain models: Order, LineItem, Customer, OrderStatus
- Business validation (email format, quantity/price positivity)
- DynamoDB single-table design with two GSIs
- EventBridge event bus with typed event shapes
- SQS queues with DLQs for each processing stage
- Lambda handlers: ingest, validate, enrich, complete, query, dlq-monitor
- React frontend (dark theme, live-polling order list, order form)
- CI workflow (lint, typecheck, unit tests, integration tests)
- Local development via LocalStack
