import { SPAPIRequestResponse } from "@/app/model/types";
import getSPAPIEndpoint, {
  buildGrantLessNotificationsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import {
  CREATE_DESTINATION_API_DOC_LINK,
  CREATE_DESTINATION_API_NAME,
  EVENT_BRIDGE_DESTINATION_NAME,
  GET_DESTINATIONS_API_DOC_LINK,
  GET_DESTINATIONS_API_NAME,
} from "@/app/constants/global";
import {
  CreateDestinationRequest,
  Destination,
  DestinationList,
  GetDestinationsResponse,
} from "@/app/sdk/notifications";

/**
 * Helper method which invokes the GetDestinations API to fetch all the
 * event bridge destinations.
 * @param region the AWS region.
 * @param awsAccountId the AWS awsAccountId.
 * @param reqResponseCollector collects all the SP API requests and responses.
 */
export async function getEventBridgeDestinations(
  region: string,
  awsAccountId: string,
  reqResponseCollector: SPAPIRequestResponse[],
) {
  const notificationsApi = await buildGrantLessNotificationsAPIClient(
    getSPAPIEndpoint(region),
  );
  const requestResponse: SPAPIRequestResponse = {
    apiName: GET_DESTINATIONS_API_NAME,
    apiDocumentationLink: GET_DESTINATIONS_API_DOC_LINK,
    request: {},
    response: {},
  };

  try {
    const getDestinationsResponse: GetDestinationsResponse =
      GetDestinationsResponse.constructFromObject(
        await notificationsApi.getDestinations(),
        undefined,
      );
    requestResponse.response = getDestinationsResponse;
    const destinations: Destination[] = DestinationList.constructFromObject(
      getDestinationsResponse.payload,
      undefined,
    );

    return destinations?.filter(
      (destination) =>
        destination?.resource?.eventBridge?.accountId === awsAccountId &&
        destination?.resource?.eventBridge?.region === region,
    );
  } catch (error: any) {
    requestResponse.response = error;
    if (!(error?.status === 404)) {
      throw error;
    }
  } finally {
    reqResponseCollector.push(requestResponse);
  }
}

/**
 * Helper method which invokes the CreateDestination API to create new event bridge destination.
 * @param awsAccountId the AWS awsAccountId.
 * @param region the AWS region.
 * @param reqResponseCollector collects all the SP API requests and responses.
 */
export async function createEventBridgeDestination(
  awsAccountId: string,
  region: string,
  reqResponseCollector: SPAPIRequestResponse[],
) {
  const notificationsApi = await buildGrantLessNotificationsAPIClient(
    getSPAPIEndpoint(region),
  );
  const destinationResourceSpecification = {
    eventBridge: {
      region: region,
      accountId: awsAccountId,
    },
  };
  const createDestinationRequestBody =
    CreateDestinationRequest.constructFromObject(
      {
        resourceSpecification: destinationResourceSpecification,
        name: EVENT_BRIDGE_DESTINATION_NAME,
      },
      undefined,
    );
  const requestResponse = {
    apiName: CREATE_DESTINATION_API_NAME,
    apiDocumentationLink: CREATE_DESTINATION_API_DOC_LINK,
    request: {
      body: createDestinationRequestBody,
    },
    response: {},
  };

  try {
    requestResponse.response = await notificationsApi.createDestination(
      requestResponse.request.body,
    );
  } catch (error: any) {
    requestResponse.response = error;
    throw error;
  } finally {
    reqResponseCollector.push(requestResponse);
  }
  return requestResponse.response;
}
