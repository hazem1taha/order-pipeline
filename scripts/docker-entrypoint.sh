#!/bin/bash
set -e

echo "Seeding LocalStack..."
bash /app/scripts/seed-localstack.sh

echo "Starting serverless offline..."
exec npx serverless offline --stage local --host 0.0.0.0 --reloadHandler
