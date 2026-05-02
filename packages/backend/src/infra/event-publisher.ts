import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { config } from '../config.js';
import { createLogger } from './logger.js';

export interface EventPublisher {
  publish(eventType: string, detail: Record<string, unknown>): Promise<void>;
}

const logger = createLogger();

export class EventBridgePublisher implements EventPublisher {
  private client: EventBridgeClient;
  private busName: string;

  constructor() {
    const clientConfig: { region: string; endpoint?: string } = {
      region: config.AWS_REGION,
    };
    if (config.LOCALSTACK_URL) {
      clientConfig.endpoint = config.LOCALSTACK_URL;
    }
    this.client = new EventBridgeClient(clientConfig);
    this.busName = config.EVENT_BUS_NAME;
  }

  async publish(eventType: string, detail: Record<string, unknown>): Promise<void> {
    const entry = {
      EventBusName: this.busName,
      Source: 'order-pipeline',
      'DetailType': eventType,
      Detail: JSON.stringify(detail),
    };

    try {
      await this.client.send(new PutEventsCommand({ Entries: [entry] }));
      logger.info('Event published', { eventType, busName: this.busName });
    } catch (err) {
      logger.error('Failed to publish event', { eventType, error: String(err) });
      throw err;
    }
  }
}
