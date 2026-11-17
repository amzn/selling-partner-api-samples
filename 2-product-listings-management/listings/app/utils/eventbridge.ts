import {
  EventBridge,
  ListRulesCommandOutput,
  ListTargetsByRuleCommandOutput,
  RemoveTargetsCommandOutput,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
  Rule,
  RuleState,
  Target,
} from "@aws-sdk/client-eventbridge";
import { serializeToJsonString } from "@/app/utils/serialization";
import { buildEventBridgeClient } from "@/app/utils/aws-clients-factory";
import {
  buildEventBusFilterRuleName,
  buildNotificationSQSQueueArn,
  buildNotificationSQSTargetName,
} from "@/app/utils/aws";
import { createQueue } from "@/app/utils/sqs";

function handleEventBridgeError(error: any) {
  console.log(serializeToJsonString(error));
  if (!(error instanceof ResourceNotFoundException)) {
    throw {
      status: 500,
    };
  }
}

/**
 * Helper method which returns the [Rule, Target] information for the given
 * eventbus.
 * @param region the aws region.
 * @param eventBusName the event bus name.
 */
export async function getRuleTargetsForEventBus(
  region: string,
  eventBusName: string,
) {
  const ruleTargets: { rule: Rule; target: Target }[] = [];
  const eventBridge = buildEventBridgeClient(region);
  try {
    let listRulesNextToken = undefined;
    do {
      const listRulesCommandOutput: ListRulesCommandOutput =
        await eventBridge.listRules({
          EventBusName: eventBusName,
          NextToken: listRulesNextToken,
        });
      listRulesNextToken = listRulesCommandOutput?.NextToken;

      const rules = listRulesCommandOutput?.Rules ?? [];
      for (const rule of rules) {
        let listTargetsByRuleNextToken = undefined;
        do {
          const listTargetsByRuleCommandOutput: ListTargetsByRuleCommandOutput =
            await eventBridge.listTargetsByRule({
              EventBusName: eventBusName,
              Rule: rule.Name,
            });
          listTargetsByRuleNextToken =
            listTargetsByRuleCommandOutput?.NextToken;
          const targets = listTargetsByRuleCommandOutput?.Targets ?? [];
          for (const target of targets) {
            ruleTargets.push({
              rule: rule,
              target: target,
            });
          }
        } while (listTargetsByRuleNextToken);
      }
    } while (listRulesNextToken);
  } catch (error) {
    handleEventBridgeError(error);
  }
  return ruleTargets;
}

async function removeTarget(
  eventBridge: EventBridge,
  eventBusName: string,
  rule: string,
  targetId: string,
) {
  try {
    const removeTargetsCommandOutput: RemoveTargetsCommandOutput =
      await eventBridge.removeTargets({
        EventBusName: eventBusName,
        Rule: rule,
        Ids: [targetId],
      });

    if (removeTargetsCommandOutput?.FailedEntryCount !== 0) {
      removeTargetsCommandOutput.FailedEntries?.forEach((failedEntry) => {
        console.log(serializeToJsonString(failedEntry));
      });
      handleEventBridgeError("removeTargets API returned 1 FailedEntryCount");
    }
  } catch (error) {
    handleEventBridgeError(error);
  }
}

async function createTarget(
  eventBridge: EventBridge,
  eventBusName: string,
  region: string,
  awsAccountId: string,
  notificationType: string,
) {
  try {
    const putTargetsResponse = await eventBridge.putTargets({
      EventBusName: eventBusName,
      Rule: buildEventBusFilterRuleName(notificationType),
      Targets: [
        {
          Arn: buildNotificationSQSQueueArn(
            region,
            awsAccountId,
            notificationType,
          ),
          Id: buildNotificationSQSTargetName(notificationType),
        },
      ],
    });

    if (putTargetsResponse?.FailedEntryCount !== 0) {
      putTargetsResponse.FailedEntries?.forEach((failedEntry) => {
        console.log(serializeToJsonString(failedEntry));
      });
      handleEventBridgeError(
        "putTargets API returned at least 1 FailedEntryCount",
      );
    }
  } catch (error: any) {
    if (!(error instanceof ResourceAlreadyExistsException)) {
      handleEventBridgeError(error);
    }
  }
}

async function deleteRule(
  eventBridge: EventBridge,
  eventBusName: string,
  rule: string,
) {
  try {
    await eventBridge.deleteRule({
      EventBusName: eventBusName,
      Name: rule,
    });
  } catch (error) {
    handleEventBridgeError(error);
  }
}

async function createRule(
  eventBridge: EventBridge,
  eventBusName: string,
  notificationType: string,
) {
  try {
    await eventBridge.putRule({
      Name: buildEventBusFilterRuleName(notificationType),
      EventBusName: eventBusName,
      Description: getEventBusRuleDescription(notificationType),
      EventPattern: getSPAPIEventPatternForEventBusRule(notificationType),
      State: RuleState.ENABLED,
    });
  } catch (error: any) {
    if (!(error instanceof ResourceAlreadyExistsException)) {
      handleEventBridgeError(error);
    }
  }
}

/**
 * Helper method which removes the target and deletes the rule.
 * @param eventBusName name of the event bus.
 * @param rule the event bus rule to delete.
 * @param targetId the Id of the target to remove from the rule.
 * @param region the AWS region.
 */
export async function removeTargetAndDeleteRule(
  eventBusName: string,
  rule: string,
  targetId: string,
  region: string,
) {
  const eventBridge = buildEventBridgeClient(region);
  await removeTarget(eventBridge, eventBusName, rule, targetId);
  await deleteRule(eventBridge, eventBusName, rule);
}

async function createAndAssociateEventBusHelper(
  eventBridge: EventBridge,
  eventBusName: string,
) {
  try {
    await eventBridge.createEventBus({
      Name: eventBusName,
      EventSourceName: eventBusName,
    });
  } catch (error: any) {
    if (!(error instanceof ResourceAlreadyExistsException)) {
      handleEventBridgeError(error);
    }
  }
}

/**
 * Helper method to create(If one does not exist already) and associate Event Bus.
 *
 * @param eventBusName EventBus Name.
 * @param region AWS region.
 */
export async function createAndAssociateEventBus(
  eventBusName: string,
  region: string,
) {
  const eventBridge = buildEventBridgeClient(region);
  await createAndAssociateEventBusHelper(eventBridge, eventBusName);
}

/**
 * Helper method to create the necessary Event Bridge resources
 * 1. Create New Event Bus Rule.
 * 2. Create New SQS Queue(For each notification type, if not created already).
 * 3. Create New Target.
 *
 * @param eventBusName EventBus Name.
 * @param notificationType Type of the Notification.
 * @param awsAccountId AWS Account associated with the application.
 * @param region AWS region.
 */
export async function createEventBridgeResources(
  eventBusName: string,
  notificationType: string,
  awsAccountId: string,
  region: string,
) {
  const eventBridge = buildEventBridgeClient(region);
  await createRule(eventBridge, eventBusName, notificationType);
  await createQueue(notificationType, region, awsAccountId, eventBusName);
  await createTarget(
    eventBridge,
    eventBusName,
    region,
    awsAccountId,
    notificationType,
  );
}

function getEventBusRuleDescription(notificationType: string) {
  return `Event Bus rule to receive the ${notificationType} notifications from the selling partner API.`;
}

// Function to get the SP-API Event Pattern for EventBus Rule.
// https://tinyurl.com/bdf98t9f
function getSPAPIEventPatternForEventBusRule(notificationType: string) {
  return `
    {
      "source": [
        {
          "prefix": "aws.partner/sellingpartnerapi.amazon.com"
        }
      ],
      "detail-type": ["${notificationType}"]
    }
  `;
}
