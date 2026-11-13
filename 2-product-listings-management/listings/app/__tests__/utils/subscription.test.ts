import getSPAPIEndpoint, {
  buildGrantLessNotificationsAPIClient,
  buildNotificationsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { NotificationsApi } from "@/app/sdk/notifications";
import { MOCK_SUBSCRIPTION_1 } from "@/app/test-utils/mock-subscription";
import {
  createSubscription,
  deleteSubscription,
  getAllListingRawSubscriptions,
  getDisplayableListingSubscriptions,
} from "@/app/utils/subscription";
import { SPAPIRequestResponse } from "@/app/model/types";
import { getEventBridgeDestinations } from "@/app/utils/destination";
import { getRuleTargetsForEventBus } from "@/app/utils/eventbridge";
import {
  buildEventBusFilterRuleName,
  buildNotificationSQSQueueName,
  buildNotificationSQSTargetName,
} from "@/app/utils/aws";
import {
  IPTC_NOTIFICATION_TYPE,
  LIIC_NOTIFICATION_TYPE,
} from "@/app/constants/global";

const SUBSCRIPTION_ID = "0c49f1df-6dab-4ac1-a887-87db417952d3";
const EVENT_BUS_NAME =
  "sellingpartnerapi.amazon.com/amzn1.sellerapps.app.15a75829-cd4a-4efc-b947-0cc39d874577";
const AWS_ACCOUNT_ID = "123456789";
const DESTINATION_ID = "0c43f1df-6dab-4ac1-a887-87db417972d3";

jest.mock("@/app/sdk/factory/ListingsSPAPIClientsFactory");
const mockedGetSPAPIEndpoint = jest.mocked(getSPAPIEndpoint);
mockedGetSPAPIEndpoint.mockReturnValue("");

const notificationsApi = new NotificationsApi(undefined);
const grantlessNotificationsApi = new NotificationsApi(undefined);
const mockedGetSubscription = jest.fn();
const mockedDeleteSubscriptionById = jest.fn();
const mockedCreateSubscription = jest.fn();
notificationsApi.getSubscription = mockedGetSubscription;
notificationsApi.createSubscription = mockedCreateSubscription;
grantlessNotificationsApi.deleteSubscriptionById = mockedDeleteSubscriptionById;

const mockedBuildNotificationsAPIClient = jest.mocked(
  buildNotificationsAPIClient,
);
const mockedBuildGrantLessNotificationsAPIClient = jest.mocked(
  buildGrantLessNotificationsAPIClient,
);
mockedBuildNotificationsAPIClient.mockResolvedValue(notificationsApi);
mockedBuildGrantLessNotificationsAPIClient.mockResolvedValue(
  grantlessNotificationsApi,
);

jest.mock("@/app/utils/destination");
const mockedGetEventBridgeDestinations = jest.mocked(
  getEventBridgeDestinations,
);

jest.mock("@/app/utils/eventbridge");
const mockedGetRuleTargetsForEventBus = jest.mocked(getRuleTargetsForEventBus);

const REGION = "us-east-1";
describe("Test for the subscription", () => {
  describe("Test for the deleteSubscription", () => {
    test("snapshot test for 200 response from DeleteSubscriptionById API", async () => {
      mockedDeleteSubscriptionById.mockResolvedValue({});

      const reqResponses: SPAPIRequestResponse[] = [];
      await deleteSubscription(
        SUBSCRIPTION_ID,
        IPTC_NOTIFICATION_TYPE,
        REGION,
        reqResponses,
      );
      expect(reqResponses).toMatchSnapshot();
    });

    test("snapshot test for 404 response from DeleteSubscriptionById API", async () => {
      mockedDeleteSubscriptionById.mockRejectedValue({
        status: 404,
      });

      const reqResponses: SPAPIRequestResponse[] = [];
      await deleteSubscription(
        SUBSCRIPTION_ID,
        IPTC_NOTIFICATION_TYPE,
        REGION,
        reqResponses,
      );
      expect(reqResponses).toMatchSnapshot();
    });

    test("snapshot test for 500 response from DeleteSubscriptionById API", async () => {
      mockedDeleteSubscriptionById.mockRejectedValue({
        status: 500,
      });

      const reqResponses: SPAPIRequestResponse[] = [];
      await expect(
        deleteSubscription(
          SUBSCRIPTION_ID,
          IPTC_NOTIFICATION_TYPE,
          REGION,
          reqResponses,
        ),
      ).rejects.toMatchObject({
        status: 500,
      });
      expect(reqResponses).toMatchSnapshot();
    });
  });

  describe("Test for the getAllListingRawSubscriptions", () => {
    test("snapshot test for 200 and 404 responses from GetSubscription API", async () => {
      mockedGetSubscription
        .mockResolvedValueOnce({
          payload: {
            subscriptionId: MOCK_SUBSCRIPTION_1.subscriptionId,
            payloadVersion: "1.0",
            destinationId: MOCK_SUBSCRIPTION_1.subscriptionId,
          },
        })
        .mockRejectedValue({
          status: 404,
        });

      const reqResponses: SPAPIRequestResponse[] = [];
      const rawSubscriptions = await getAllListingRawSubscriptions(
        REGION,
        false,
        reqResponses,
      );
      expect(rawSubscriptions).toMatchSnapshot();
      expect(reqResponses).toMatchSnapshot();
    });

    test("snapshot test for the 500 response from GetSubscription API", async () => {
      mockedGetSubscription.mockRejectedValue({
        status: 500,
      });

      const reqResponses: SPAPIRequestResponse[] = [];
      await expect(
        getAllListingRawSubscriptions(REGION, false, reqResponses),
      ).rejects.toMatchObject({
        status: 500,
      });
      expect(reqResponses).toMatchSnapshot();
    });
  });

  function mockGetSubscriptionForDisplayableSubscriptionsTest() {
    mockedGetSubscription
      // UnMatched
      .mockResolvedValueOnce({
        payload: {
          subscriptionId: "99821be8-8dfe-4c1c-a1f7-895ab790cb4f",
          payloadVersion: "1.0",
          destinationId: "40807127-05cf-4e75-b833-1778eb7d9530",
        },
      })
      // Matched with two rules
      .mockResolvedValueOnce({
        payload: {
          subscriptionId: "5f21f928-ca44-414c-a5c6-6a3729cb6b5c",
          payloadVersion: "1.0",
          destinationId: "f0195c18-3ff4-471e-8618-b406e0f37cbc",
        },
      })
      // Matched with no rules
      .mockResolvedValueOnce({
        payload: {
          subscriptionId: "83d66cc2-9063-43f7-b1a1-391a7aa0bba8",
          payloadVersion: "1.0",
          destinationId: "f0195c18-3ff4-471e-8618-b406e0f37cbc",
        },
      })
      // Matched with one rule
      .mockResolvedValueOnce({
        payload: {
          subscriptionId: "04fb6be6-c49a-4016-be54-2da408b91175",
          payloadVersion: "1.0",
          destinationId: "f0195c18-3ff4-471e-8618-b406e0f37cbc",
        },
      })
      // UnMatched
      .mockResolvedValueOnce({
        payload: {
          subscriptionId: "b541bb7f-4581-43d0-ab6b-c2ad63cd3bfe",
          payloadVersion: "1.0",
          destinationId: "72286d85-66b3-47e2-9762-88baaf9aef05",
        },
      })
      .mockRejectedValue({
        status: 404,
      });
  }

  describe("Test for the getDisplayableListingSubscriptions", () => {
    test("snapshot test which covers all the major edge cases", async () => {
      mockGetSubscriptionForDisplayableSubscriptionsTest();

      mockedGetEventBridgeDestinations.mockResolvedValue([
        {
          destinationId: "f0195c18-3ff4-471e-8618-b406e0f37cbc",
          name: "TestEventBridgeDestination",
          resource: {
            eventBridge: {
              name: EVENT_BUS_NAME,
              accountId: AWS_ACCOUNT_ID,
              region: REGION,
            },
          },
        },
      ]);

      mockedGetRuleTargetsForEventBus.mockResolvedValue([
        {
          rule: {
            Name: buildEventBusFilterRuleName(IPTC_NOTIFICATION_TYPE),
            EventBusName: EVENT_BUS_NAME,
          },
          target: {
            Id: buildNotificationSQSTargetName(IPTC_NOTIFICATION_TYPE),
            Arn: `arn:aws:sqs:${REGION}:${AWS_ACCOUNT_ID}:${buildNotificationSQSQueueName(
              IPTC_NOTIFICATION_TYPE,
            )}`,
          },
        },
        {
          rule: {
            Name: buildEventBusFilterRuleName(IPTC_NOTIFICATION_TYPE),
            EventBusName: EVENT_BUS_NAME,
          },
          target: {
            Id: "ItemProductTypeChangeTarget1",
            Arn: `arn:aws:sqs:${REGION}:${AWS_ACCOUNT_ID}:${buildNotificationSQSQueueName(
              IPTC_NOTIFICATION_TYPE,
            )}`,
          },
        },
        {
          rule: {
            Name: buildEventBusFilterRuleName(LIIC_NOTIFICATION_TYPE),
            EventBusName: EVENT_BUS_NAME,
          },
          target: {
            Id: buildNotificationSQSTargetName(LIIC_NOTIFICATION_TYPE),
            Arn: `arn:aws:sqs:${REGION}:${AWS_ACCOUNT_ID}:${buildNotificationSQSQueueName(
              LIIC_NOTIFICATION_TYPE,
            )}`,
          },
        },
      ]);

      const reqResponses: any[] = [];
      const displayableSubscriptions = await getDisplayableListingSubscriptions(
        AWS_ACCOUNT_ID,
        REGION,
        true,
        reqResponses,
      );
      expect(displayableSubscriptions).toMatchSnapshot();
    });

    test("snapshot test for no destinations", async () => {
      mockGetSubscriptionForDisplayableSubscriptionsTest();

      mockedGetEventBridgeDestinations.mockResolvedValue([]);

      const reqResponses: any[] = [];
      const displayableSubscriptions = await getDisplayableListingSubscriptions(
        AWS_ACCOUNT_ID,
        REGION,
        true,
        reqResponses,
      );
      expect(displayableSubscriptions).toMatchSnapshot();
    });
  });

  describe("Test for the create Subscription", () => {
    test("snapshot test for 200 response from CreateSubscription API", async () => {
      mockedCreateSubscription.mockResolvedValue({});

      const reqResponses: SPAPIRequestResponse[] = [];
      await createSubscription(
        REGION,
        DESTINATION_ID,
        IPTC_NOTIFICATION_TYPE,
        reqResponses,
      );

      expect(reqResponses).toMatchSnapshot();
    });

    test("snapshot test for 409 Conflict response from CreateSubscription API", async () => {
      mockedCreateSubscription.mockRejectedValue({
        status: 409,
      });

      const reqResponses: SPAPIRequestResponse[] = [];
      await expect(
        createSubscription(
          REGION,
          DESTINATION_ID,
          IPTC_NOTIFICATION_TYPE,
          reqResponses,
        ),
      ).rejects.toMatchObject({
        status: 409,
      });

      expect(reqResponses).toMatchSnapshot();
    });
  });
});
