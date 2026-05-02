import type { SQSEvent } from 'aws-lambda';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { config } from '../config.js';
import { createLogger } from '../infra/logger.js';

const logger = createLogger();

const DLQ_NAMES = [
  'order-validation-dlq',
  'order-enrichment-dlq',
  'order-completion-dlq',
];

async function inspectDLQ(queueName: string, sqsClient: SQSClient): Promise<void> {
  const queueUrl = `http://localhost:4566/000000000000/${queueName}`;

  const result = await sqsClient.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxMessages: 10,
      WaitTimeSeconds: 5,
    }),
  );

  const now = Date.now();
  for (const msg of result.Messages ?? []) {
    const body = msg.Body ? JSON.parse(msg.Body) : null;
    const sentTimestamp = msg.Attributes?.ApproximateFirstReceiveTimestamp
      ? parseInt(msg.Attributes.ApproximateFirstReceiveTimestamp, 10)
      : now;
    const ageHours = (now - sentTimestamp) / (1000 * 60 * 60);

    const logMeta = {
      queue: queueName,
      orderId: body?.detail?.orderId ?? 'unknown',
      tenantId: body?.detail?.tenantId ?? 'unknown',
      messageId: msg.MessageId,
      receiptHandle: msg.ReceiptHandle,
      ageHours: Math.round(ageHours * 10) / 10,
      rawBody: body,
    };

    if (ageHours > 1) {
      logger.error('DLQ message older than 1 hour — HIGH SEVERITY', logMeta);
    } else {
      logger.warn('DLQ message found', logMeta);
    }

    if (msg.ReceiptHandle) {
      await sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: msg.ReceiptHandle,
        }),
      );
    }
  }
}

async function handleDLQMonitor(): Promise<void> {
  const sqsClient = new SQSClient({
    region: config.AWS_REGION,
    endpoint: config.LOCALSTACK_URL,
  });

  for (const dlqName of DLQ_NAMES) {
    try {
      await inspectDLQ(dlqName, sqsClient);
    } catch (err) {
      logger.error('Failed to inspect DLQ', { queue: dlqName, error: String(err) });
    }
  }
}

export const dlqMonitorHandler = handleDLQMonitor;
