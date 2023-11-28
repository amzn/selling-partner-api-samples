import nextResponse from "@/app/utils/next-response-factory";
import { serializeToJsonString } from "@/app/utils/serialization";
import {
  handleChainedSPAPIInvocationError,
  retrieveSettingsAndInvokeAPILogic,
  retrieveSettingsAndInvokeAPILogicWithRequest,
} from "@/app/utils/api";
import { NextRequest, NextResponse } from "next/server";
import {
  SELLING_PARTNER_TYPE_KEY_MERCHANT_ACCOUNT_ID,
  Settings,
} from "@/app/[locale]/settings/settings";
import {
  createSubscription,
  deleteSubscription,
  getDisplayableListingSubscriptions,
} from "@/app/utils/subscription";
import { SPAPIRequestResponse, Subscription } from "@/app/model/types";
import {
  createAndAssociateEventBus,
  createEventBridgeResources,
  removeTargetAndDeleteRule,
} from "@/app/utils/eventbridge";
import { deleteQueue } from "@/app/utils/sqs";
import {
  createEventBridgeDestination,
  getEventBridgeDestinations,
} from "@/app/utils/destination";
import { headers } from "next/dist/client/components/headers";
import { NOTIFICATION_TYPE_HEADER } from "@/app/constants/global";
import {
  CreateDestinationResponse,
  CreateSubscriptionResponse,
  Destination,
} from "@/app/sdk/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  return retrieveSettingsAndInvokeAPILogic(getSubscriptionHandler);
}

async function getSubscriptionHandler(settings: Settings) {
  const reqResponses: SPAPIRequestResponse[] = [];
  try {
    const subscriptions = await getDisplayableListingSubscriptions(
      settings.accountId,
      settings.region,
      settings.sellingPartnerIdType ===
        SELLING_PARTNER_TYPE_KEY_MERCHANT_ACCOUNT_ID,
      reqResponses,
    );
    return nextResponse(
      200,
      "OK",
      serializeToJsonString({
        data: subscriptions,
        debugContext: reqResponses,
      }),
    );
  } catch (error) {
    return handleChainedSPAPIInvocationError(error, reqResponses);
  }
}

export async function DELETE(request: NextRequest) {
  return retrieveSettingsAndInvokeAPILogicWithRequest(
    deleteSubscriptionHandler,
    request,
  );
}

async function deleteSubscriptionHandler(
  settings: Settings,
  request: NextRequest,
) {
  const reqParamsOrNextResponse =
    await validateAndRetrieveRequiredParametersForDeleteRequest(request);
  if (reqParamsOrNextResponse instanceof NextResponse) {
    return reqParamsOrNextResponse;
  }
  const { subscription } = reqParamsOrNextResponse;
  const reqResponses: SPAPIRequestResponse[] = [];
  try {
    if (
      subscription.eventBusName &&
      subscription.eventBusFilterRule &&
      subscription.sqsTargetId
    ) {
      await removeTargetAndDeleteRule(
        subscription.eventBusName,
        subscription.eventBusFilterRule,
        subscription.sqsTargetId,
        settings.region,
      );
    }

    if (subscription.sqsQueueName) {
      await deleteQueue(
        settings.accountId,
        settings.region,
        subscription.sqsQueueName,
      );
    }

    await deleteSubscription(
      subscription.subscriptionId,
      subscription.notificationType,
      settings.region,
      reqResponses,
    );

    return nextResponse(
      200,
      "OK",
      serializeToJsonString({
        data: {},
        debugContext: reqResponses,
      }),
    );
  } catch (error) {
    return handleChainedSPAPIInvocationError(error, reqResponses);
  }
}

async function validateAndRetrieveRequiredParametersForDeleteRequest(
  request: NextRequest,
) {
  const subscription: Subscription = await request.json();
  if (
    !subscription?.subscriptionId?.length ||
    !subscription?.notificationType?.length
  ) {
    const errorMessage =
      "The request body is missing either the subscriptionId or notificationType";
    return nextResponse(400, errorMessage);
  }
  return { subscription };
}

export async function POST() {
  return retrieveSettingsAndInvokeAPILogic(createSubscriptionHandler);
}

async function createSubscriptionHandler(settings: Settings) {
  const requiredParametersResponse =
    await validateAndRetrieveRequiredParametersForPostRequest();

  if (requiredParametersResponse instanceof NextResponse) {
    return requiredParametersResponse;
  }

  const { notificationType } = requiredParametersResponse;
  const reqResponses: SPAPIRequestResponse[] = [];

  try {
    const eventBridgeDestination = await getOrCreateEventBridgeDestination(
      settings,
      reqResponses,
    );

    await createAndAssociateEventBus(
      eventBridgeDestination.resource.eventBridge.name,
      settings.region,
    );

    let createSubscriptionSPAPIResponse: SPAPIRequestResponse;
    // Create Subscription for the appropriate notification type.
    try {
      createSubscriptionSPAPIResponse = await createSubscription(
        settings.region,
        eventBridgeDestination.destinationId,
        notificationType,
        reqResponses,
      );

      // Create necessary EventBridge resources only when CreateSubscription call succeeds.
      await createEventBridgeResources(
        eventBridgeDestination.resource.eventBridge.name,
        notificationType,
        settings.accountId,
        settings.region,
      );
    } catch (error: any) {
      // We should treat 409(Conflict resource) as success response.
      if (error.status === 409) {
        return nextResponse(
          200,
          "OK",
          serializeToJsonString({
            data: {},
            debugContext: reqResponses,
          }),
        );
      }
      throw error;
    }

    const createSubscriptionResponse =
      CreateSubscriptionResponse.constructFromObject(
        createSubscriptionSPAPIResponse.response,
        undefined,
      );

    return nextResponse(
      200,
      "OK",
      serializeToJsonString({
        data: createSubscriptionResponse.payload,
        debugContext: reqResponses,
      }),
    );
  } catch (error) {
    return handleChainedSPAPIInvocationError(error, reqResponses);
  }
}

async function getOrCreateEventBridgeDestination(
  settings: Settings,
  reqResponses: SPAPIRequestResponse[],
) {
  const getDestinationsResponse = await getEventBridgeDestinations(
    settings.region,
    settings.accountId,
    reqResponses,
  );

  const existingEventBridgeDestination = getDestinationsResponse?.length
    ? getDestinationsResponse[0]
    : undefined;

  if (existingEventBridgeDestination) {
    return existingEventBridgeDestination;
  }

  // If there is no previous destination, we should create a new EventBridge Destination.
  const newEventBridgeDestinationResponse =
    CreateDestinationResponse.constructFromObject(
      await createEventBridgeDestination(
        settings.accountId,
        settings.region,
        reqResponses,
      ),
      undefined,
    );

  return Destination.constructFromObject(
    newEventBridgeDestinationResponse.payload,
    undefined,
  );
}

async function validateAndRetrieveRequiredParametersForPostRequest() {
  const validateHeadersResponse =
    validateAndRetrieveRequestParamsFromHeaderForPostRequest();

  if (validateHeadersResponse instanceof NextResponse) {
    return validateHeadersResponse;
  }

  const { notificationType } = validateHeadersResponse;
  return { notificationType };
}

function validateAndRetrieveRequestParamsFromHeaderForPostRequest() {
  const requestHeaders = headers();
  const notificationType = requestHeaders.get(NOTIFICATION_TYPE_HEADER);

  if (!notificationType) {
    const errorMessage =
      "The request is missing the notificationType in the headers";
    return nextResponse(400, errorMessage);
  }

  return { notificationType };
}
