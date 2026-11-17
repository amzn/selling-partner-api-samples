import { EventBridge } from "@aws-sdk/client-eventbridge";
import { SQS } from "@aws-sdk/client-sqs";
import { SecretsManager } from "@aws-sdk/client-secrets-manager";

const AWS_CLIENTS = new Map<string, any>();
const EVENT_BRIDGE_SERVICE = "EventBridge";
const SQS_SERVICE = "SQS";
const SECRETS_MANAGER_SERVICE = "SecretsManager";

function computeCacheKey(service: string, region: string) {
  return `${service}-${region}`;
}

function buildAndCacheAWSClient(
  service: string,
  region: string,
  createClient: (region: string) => any,
) {
  const cacheKey = computeCacheKey(service, region);
  if (AWS_CLIENTS.has(cacheKey)) {
    return AWS_CLIENTS.get(cacheKey);
  } else {
    const client = createClient(region);
    AWS_CLIENTS.set(cacheKey, client);
    return client;
  }
}

/**
 * Helper method which builds an event bridge client.
 * @param region the AWS region.
 */
export function buildEventBridgeClient(region: string) {
  return buildAndCacheAWSClient(
    EVENT_BRIDGE_SERVICE,
    region,
    (region) =>
      new EventBridge({
        region: region,
      }),
  ) as EventBridge;
}

/**
 * Helper method which builds a sqs client.
 * @param region the AWS region.
 */
export function buildSQSClient(region: string) {
  return buildAndCacheAWSClient(
    SQS_SERVICE,
    region,
    (region) =>
      new SQS({
        region: region,
      }),
  ) as SQS;
}

/**
 * Helper method which builds a secrets manager client.
 * @param region the AWS region.
 */
export function buildSecretsManagerClient(region: string) {
  return buildAndCacheAWSClient(
    SECRETS_MANAGER_SERVICE,
    region,
    (region) =>
      new SecretsManager({
        region: region,
      }),
  ) as SecretsManager;
}
