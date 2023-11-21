import getSPAPIEndpoint, {
  buildGrantLessNotificationsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { NotificationsApi } from "@/app/sdk/notifications";
import { SPAPIRequestResponse } from "@/app/model/types";
import {
  createEventBridgeDestination,
  getEventBridgeDestinations,
} from "@/app/utils/destination";

jest.mock("@/app/sdk/factory/ListingsSPAPIClientsFactory");
const mockedGetSPAPIEndpoint = jest.mocked(getSPAPIEndpoint);
mockedGetSPAPIEndpoint.mockReturnValue("");

const notificationsApi = new NotificationsApi(undefined);
const mockedGetDestinations = jest.fn();
notificationsApi.getDestinations = mockedGetDestinations;
const mockedCreateDestinations = jest.fn();
notificationsApi.createDestination = mockedCreateDestinations;

const mockedBuildGrantLessNotificationsAPIClient = jest.mocked(
  buildGrantLessNotificationsAPIClient,
);
mockedBuildGrantLessNotificationsAPIClient.mockResolvedValue(notificationsApi);

describe("Test for all the SP-API Destination APIs", () => {
  describe("Test for the getEventBridgeDestinations", () => {
    test("snapshot test for 200 response from GetDestinations API", async () => {
      mockedGetDestinations.mockResolvedValueOnce({
        payload: [
          {
            name: "TestDestination",
            destinationId: "5fe08e61-c5ec-4427-9f25-24a7b630cce2",
            resource: {
              eventBridge: {
                name: "sellingpartnerapi.amazon.com/amzn1.sellerapps.app.15a75829-cd4a-4efc-b947-0cc39d874577",
                region: "us-east-1",
                accountId: "123456",
              },
            },
          },
        ],
      });

      const reqResponses: SPAPIRequestResponse[] = [];
      const destinations = await getEventBridgeDestinations(
        "us-east-1",
        "123456",
        reqResponses,
      );
      expect(destinations).toMatchSnapshot();
      expect(reqResponses).toMatchSnapshot();
    });

    test("snapshot test for the 404 response from GetDestinations API", async () => {
      mockedGetDestinations.mockRejectedValue({
        status: 404,
      });

      const reqResponses: SPAPIRequestResponse[] = [];
      const destinations = await getEventBridgeDestinations(
        "us-east-1",
        "123456",
        reqResponses,
      );
      expect(destinations).toMatchSnapshot();
      expect(reqResponses).toMatchSnapshot();
    });

    test("snapshot test for the 500 response from GetDestinations API", async () => {
      mockedGetDestinations.mockRejectedValue({
        status: 500,
      });

      const reqResponses: SPAPIRequestResponse[] = [];
      await expect(
        getEventBridgeDestinations("us-east-1", "123456", reqResponses),
      ).rejects.toMatchObject({
        status: 500,
      });
      expect(reqResponses).toMatchSnapshot();
    });
  });

  describe("Test for the createDestinations SP-API", () => {
    test("snapshot test for 200 response from CreateDestinations API", async () => {
      mockedCreateDestinations.mockResolvedValueOnce({
        resourceSpecification: {
          eventBridge: {
            region: "us-east-1",
            accountId: "123456",
          },
        },
        name: "Custom Destination",
      });
      const reqResponses: SPAPIRequestResponse[] = [];
      const createDestinationResponse = await createEventBridgeDestination(
        "us-east-1",
        "123456",
        reqResponses,
      );

      expect(createDestinationResponse).toMatchSnapshot();
      expect(reqResponses).toMatchSnapshot();
    });

    test("snapshot test for the 404 response from CreateDestinations API", async () => {
      mockedCreateDestinations.mockRejectedValue({
        status: 404,
      });

      const reqResponses: SPAPIRequestResponse[] = [];
      await expect(
        createEventBridgeDestination("us-east-1", "123456", reqResponses),
      ).rejects.toMatchObject({
        status: 404,
      });
      expect(reqResponses).toMatchSnapshot();
    });
  });
});
