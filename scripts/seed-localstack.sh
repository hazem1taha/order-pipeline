#!/bin/bash
set -e

ENDPOINT="http://localhost:4566"
REGION="us-east-1"
TABLE_NAME="orders-local"
STAGE="local"

echo "Creating DynamoDB table..."
aws --endpoint-url=$ENDPOINT --region $REGION dynamodb create-table \
  --table-name $TABLE_NAME \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=gsi1pk,AttributeType=S \
    AttributeName=gsi1sk,AttributeType=S \
    AttributeName=gsi2pk,AttributeType=S \
    AttributeName=gsi2sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    "IndexName=GSI1,KeySchema=[{AttributeName=gsi1pk,KeyType=HASH},{AttributeName=gsi1sk,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
    "IndexName=GSI2,KeySchema=[{AttributeName=gsi2pk,KeyType=HASH},{AttributeName=gsi2sk,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
  --billing-mode PAY_PER_REQUEST \
  2>/dev/null || echo "Table already exists"

echo "Creating SQS queues..."
for queue in order-validation-queue order-enrichment-queue order-completion-queue \
             order-validation-dlq order-enrichment-dlq order-completion-dlq; do
  aws --endpoint-url=$ENDPOINT --region $REGION sqs create-queue \
    --queue-name $queue \
    --attributes MessageRetentionPeriod=1209600 \
    2>/dev/null || echo "Queue $queue already exists"
done

echo "Seed complete."
