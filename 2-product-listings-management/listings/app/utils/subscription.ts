import getSPAPIEndpoint, {
  buildGrantLessNotificationsAPIClient,
  buildNotificationsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import {
  CreateSubscriptionRequest,
  Destination,
  GetSubscriptionResponse,
} from "@/app/sdk/notifications";

import {
  RawSubscription,
  SPAPIRequestResponse,
  Subscription,
} from "@/app/model/types";
import {
  CREATE_SUBSCRIPTION_API_DOC_LINK,
  CREATE_SUBSCRIPTION_API_NAME,
  DELETE_SUBSCRIPTION_API_DOC_LINK,
  DELETE_SUBSCRIPTION_API_NAME,
  GET_SUBSCRIPTION_API_DOC_LINK,
  GET_SUBSCRIPTION_API_NAME,
  SELLER_NOTIFICATION_TYPES,
  VENDOR_NOTIFICATION_TYPES,
} from "@/app/constants/global";
import { getEventBridgeDestinations } from "@/app/utils/destination";
import { Rule, Target } from "@aws-sdk/client-eventbridge";
import { getRuleTargetsForEventBus } from "@/app/utils/eventbridge";
import {
  buildEventBusFilterRuleName,
  buildNotificationSQSQueueName,
} from "@/app/utils/aws";

/**
 * Deletes a subscription using its id.
 * @param subscriptionId the subscription identifier.
 * @param notificationType the notification type.
 * @param region the AWS region.
 * @param reqResponseCollector collects all the SP API requests and responses.
 */
export async function deleteSubscription(
  subscriptionId: string,
  notificationType: string,
  region: string,
  reqResponseCollector: SPAPIRequestResponse[],
) {
  const notificationsApi = await buildGrantLessNotificationsAPIClient(
    getSPAPIEndpoint(region),
  );
  const requestResponse: SPAPIRequestResponse = {
    apiName: DELETE_SUBSCRIPTION_API_NAME,
    apiDocumentationLink: DELETE_SUBSCRIPTION_API_DOC_LINK,
    request: {
      subscriptionId: subscriptionId,
      notificationType: notificationType,
    },
    response: {},
  };

  try {
    requestResponse.response = await notificationsApi.deleteSubscriptionById(
      subscriptionId,
      notificationType,
    );
  } catch (error: any) {
    requestResponse.response = error;
    if (!(error.status === 404 || error.status === 409)) {
      throw error;
    }
  } finally {
    reqResponseCollector.push(requestResponse);
  }
}

/**
 * Helper method which invokes the GetSubscription API to fetch all the listing
 * subscriptions.
 * @param region the AWS region.
 * @param isSeller true if the request is made for seller, false for vendor.
 * @param reqResponseCollector collects all the SP API requests and responses.
 */
export async function getAllListingRawSubscriptions(
  region: string,
  isSeller: boolean,
  reqResponseCollector: SPAPIRequestResponse[],
) {
  const rawSubscriptions: RawSubscription[] = [];
  const notificationsApi = await buildNotificationsAPIClient(
    getSPAPIEndpoint(region),
  );
  const desiredNotificationTypes = isSeller
    ? SELLER_NOTIFICATION_TYPES
    : VENDOR_NOTIFICATION_TYPES;
  for (const notificationType of desiredNotificationTypes) {
    const requestResponse: SPAPIRequestResponse = {
      apiName: GET_SUBSCRIPTION_API_NAME,
      apiDocumentationLink: GET_SUBSCRIPTION_API_DOC_LINK,
      request: {
        notificationType: notificationType,
      },
      response: {},
    };

    try {
      const getSubscriptionResponse: GetSubscriptionResponse =
        GetSubscriptionResponse.constructFromObject(
          await notificationsApi.getSubscription(notificationType),
          undefined,
        );
      requestResponse.response = getSubscriptionResponse;
      const rawSubscription: RawSubscription = {
        subscription: getSubscriptionResponse.payload,
        notificationType: notificationType,
      };
      rawSubscriptions.push(rawSubscription);
    } catch (error: any) {
      requestResponse.response = error;
      if (error.status === 404) {
        continue;
      }
      throw error;
    } finally {
      reqResponseCollector.push(requestResponse);
    }
  }
  return rawSubscriptions;
}

/**
 * Helper method which builds the displayable listing subscriptions.
 * @param awsAccountId the AWS account id.
 * @param region the AWS region.
 * @param isSeller true if the request is made for seller, false for vendor.
 * @param reqResponseCollector collects all the SP API requests and responses.
 */
export async function getDisplayableListingSubscriptions(
  awsAccountId: string,
  region: string,
  isSeller: boolean,
  reqResponseCollector: SPAPIRequestResponse[],
) {
  const rawSubscriptions: RawSubscription[] =
    (await getAllListingRawSubscriptions(
      region,
      isSeller,
      reqResponseCollector,
    )) ?? [];

  const destinations: Destination[] | undefined =
    await getEventBridgeDestinations(
      region,
      awsAccountId,
      reqResponseCollector,
    );
  const eventBridgeDestination = destinations?.length
    ? destinations[0]
    : undefined;

  if (!eventBridgeDestination) {
    // If there is no eventBridgeDestination, then just display the
    // subscriptions without Event Bus, Filter Rule, and SQS info.
    return buildDisplayableSubscriptionsNoFilterRule(rawSubscriptions);
  } else {
    // Split the subscription into two sets : one set of subscriptions whose
    // destination matches eventBridgeDestination, and other set whose
    // destination is different from eventBridgeDestination.
    const { matchedSubscriptions, unMatchedSubscriptions } =
      matchSubscriptionsToDestination(rawSubscriptions, eventBridgeDestination);
    return (
      //  Display the subscriptions with Event Bus, Filter Rule, and SQS info
      // for the matched subscriptions.
      (
        await buildDisplayableSubscriptionsWithFilterRule(
          region,
          eventBridgeDestination,
          matchedSubscriptions,
        )
      ).concat(
        // Display the subscriptions without Event Bus, Filter Rule, and SQS info.
        buildDisplayableSubscriptionsNoFilterRule(unMatchedSubscriptions),
      )
    );
  }
}

/**
 * Helper method to create Notification Subscription for the provided notification Type.
 *
 * @param region AWS region.
 * @param destinationId Destination against which the subscription will be created.
 * @param notificationType Notification type for which the subscription will be created.
 * @param reqResponseCollector Collects all the SP API requests and responses.
 */
export async function createSubscription(
  region: string,
  destinationId: string,
  notificationType: string,
  reqResponseCollector: SPAPIRequestResponse[],
) {
  const notificationsApi = await buildNotificationsAPIClient(
    getSPAPIEndpoint(region),
  );

  const createSubscriptionRequestBody =
    CreateSubscriptionRequest.constructFromObject(
      {
        payloadVersion: "1.0",
        destinationId: destinationId,
      },
      undefined,
    );
  const requestResponse = {
    apiName: CREATE_SUBSCRIPTION_API_NAME,
    apiDocumentationLink: CREATE_SUBSCRIPTION_API_DOC_LINK,
    request: {
      body: createSubscriptionRequestBody,
      notificationType: notificationType,
    },
    response: {},
  };

  try {
    requestResponse.response = await notificationsApi.createSubscription(
      requestResponse.request.body,
      requestResponse.request.notificationType,
    );
  } catch (error: any) {
    requestResponse.response = error;
    throw error;
  } finally {
    reqResponseCollector.push(requestResponse);
  }
  return requestResponse;
}

function matchSubscriptionsToDestination(
  rawSubscriptions: RawSubscription[],
  eventBridgeDestination: Destination,
) {
  const matchedSubscriptions = rawSubscriptions.filter(
    (rawSubscription: RawSubscription) =>
      rawSubscription.subscription.destinationId ===
      eventBridgeDestination.destinationId,
  );
  const unMatchedSubscriptions = rawSubscriptions.filter(
    (rawSubscription: RawSubscription) =>
      rawSubscription.subscription.destinationId !==
      eventBridgeDestination.destinationId,
  );

  return { matchedSubscriptions, unMatchedSubscriptions };
}

async function buildDisplayableSubscriptionsWithFilterRule(
  region: string,
  destination: Destination,
  rawSubscriptions: RawSubscription[],
) {
  const eventBusName = destination.resource.eventBridge.name;
  const ruleTargets: { rule: Rule; target: Target }[] =
    (await getRuleTargetsForEventBus(region, eventBusName)) ?? [];
  const displayableSubscriptions: Subscription[] = [];
  for (const rawSubscription of rawSubscriptions) {
    const filterRuleName = buildEventBusFilterRuleName(
      rawSubscription.notificationType,
    );
    const sqsQueueName = buildNotificationSQSQueueName(
      rawSubscription.notificationType,
    );

    const matchedRuleTargets = ruleTargets.filter(
      (ruleTarget) =>
        ruleTarget.rule.Name === filterRuleName &&
        ruleTarget.target.Arn?.endsWith(sqsQueueName),
    );

    if (matchedRuleTargets?.length === 1) {
      // If there is only one matched target, then display the subscription
      // with the details of matchedRuleTarget.
      const matchedRuleTarget = matchedRuleTargets[0];
      displayableSubscriptions.push({
        subscriptionId: rawSubscription.subscription.subscriptionId,
        notificationType: rawSubscription.notificationType,
        eventBusName: eventBusName,
        eventBusFilterRule: matchedRuleTarget.rule.Name,
        sqsTargetId: matchedRuleTarget.target.Id,
        sqsQueueName: sqsQueueName,
      });
    } else {
      // If more than 1 rule target matches, then it is an ambiguous situation.
      // In that case, display the subscription with just Event Bus.
      // If there is no rule matches, then display the subscription
      // with just Event Bus.
      displayableSubscriptions.push({
        subscriptionId: rawSubscription.subscription.subscriptionId,
        notificationType: rawSubscription.notificationType,
        eventBusName: eventBusName,
      });
    }
  }
  return displayableSubscriptions;
}

function buildDisplayableSubscriptionsNoFilterRule(
  rawSubscriptions: RawSubscription[],
) {
  const displayableSubscriptions: Subscription[] = [];
  for (const rawSubscription of rawSubscriptions) {
    // Display the subscription without Event Bus, Filter Rule, and SQS info.
    displayableSubscriptions.push({
      subscriptionId: rawSubscription.subscription.subscriptionId,
      notificationType: rawSubscription.notificationType,
    });
  }
  return displayableSubscriptions;
}
