#!/bin/bash
set -e
docker-compose up -d
echo "Waiting for LocalStack to be ready..."
sleep 15
aws --endpoint-url=http://localhost:4566 configure set region us-east-1
aws --endpoint-url=http://localhost:4566 configure set aws_access_key_id test
aws --endpoint-url=http://localhost:4566 configure set aws_secret_access_key test
echo "LocalStack ready at http://localhost:4566"
