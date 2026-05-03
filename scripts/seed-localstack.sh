#!/bin/bash
set -e

ENDPOINT="${LOCALSTACK_URL:-http://localhost:4566}"
REGION="${AWS_REGION:-eu-west-1}"
ACCOUNT="000000000000"
TABLE_NAME="orders-local"
BUS_NAME="orders-bus-local"

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

echo "Creating EventBridge bus..."
aws --endpoint-url=$ENDPOINT --region $REGION events create-event-bus \
  --name $BUS_NAME \
  2>/dev/null || echo "Bus already exists"

echo "Creating EventBridge rules..."
declare -A RULES
RULES["order-received-rule"]='{"source":["order-pipeline"],"detail-type":["order.received"]}'
RULES["order-validated-rule"]='{"source":["order-pipeline"],"detail-type":["order.validated"]}'
RULES["order-enriched-rule"]='{"source":["order-pipeline"],"detail-type":["order.enriched"]}'
RULES["order-failed-rule"]='{"source":["order-pipeline"],"detail-type":["order.failed"]}'

declare -A RULE_QUEUES
RULE_QUEUES["order-received-rule"]="order-validation-queue"
RULE_QUEUES["order-validated-rule"]="order-enrichment-queue"
RULE_QUEUES["order-enriched-rule"]="order-completion-queue"
RULE_QUEUES["order-failed-rule"]="order-completion-queue"

for rule in "${!RULES[@]}"; do
  aws --endpoint-url=$ENDPOINT --region $REGION events put-rule \
    --name $rule \
    --event-bus-name $BUS_NAME \
    --event-pattern "${RULES[$rule]}" \
    --state ENABLED \
    2>/dev/null || echo "Rule $rule already exists"

  QUEUE="${RULE_QUEUES[$rule]}"
  QUEUE_ARN="arn:aws:sqs:$REGION:$ACCOUNT:$QUEUE"

  aws --endpoint-url=$ENDPOINT --region $REGION events put-targets \
    --rule $rule \
    --event-bus-name $BUS_NAME \
    --targets "Id=$QUEUE,Arn=$QUEUE_ARN" \
    2>/dev/null || echo "Target for $rule already exists"
done

echo "Setting SQS queue policies to allow EventBridge..."
BUS_ARN="arn:aws:events:$REGION:$ACCOUNT:event-bus/$BUS_NAME"
for queue in order-validation-queue order-enrichment-queue order-completion-queue; do
  QUEUE_URL="http://sqs.$REGION.localhost.localstack.cloud:4566/$ACCOUNT/$queue"
  QUEUE_ARN="arn:aws:sqs:$REGION:$ACCOUNT:$queue"
  POLICY=$(cat <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"events.amazonaws.com"},"Action":"sqs:SendMessage","Resource":"$QUEUE_ARN","Condition":{"ArnEquals":{"aws:SourceArn":"$BUS_ARN"}}}]}
EOF
)
  aws --endpoint-url=$ENDPOINT --region $REGION sqs set-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attributes "Policy=$(echo $POLICY | tr -d '\n')" \
    2>/dev/null || echo "Policy for $queue already set"
done

echo "Seed complete."
