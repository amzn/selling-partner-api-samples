import {
  CreateDestinationResponse,
  Destination,
} from "@/app/sdk/notifications";

export const MOCK_DESTINATION: Destination = {
  name: "TestDestination",
  destinationId: "5fe08e61-c5ec-4427-9f25-24a7b630cce2",
  resource: {
    eventBridge: {
      name: "sellingpartnerapi.amazon.com/amzn1.sellerapps.app.15a75829-cd4a-4efc-b947-0cc39d874577",
      region: "us-east-1",
      accountId: "123456",
    },
  },
};

export const MOCK_CREATE_DESTINATION_RESPONSE: CreateDestinationResponse = {
  payload: MOCK_DESTINATION,
  errors: {},
};
