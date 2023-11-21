import {
  createSubscription,
  deleteSubscription,
  getDisplayableListingSubscriptions,
} from "@/app/utils/subscription";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import { getSettings } from "@/app/api/settings/wrapper";
import fetch from "jest-fetch-mock";
import {
  MOCK_CREATE_SUBSCRIPTION_SP_API_RESPONSE,
  MOCK_SUBSCRIPTION_1,
  MOCK_SUBSCRIPTION_2,
  MOCK_SUBSCRIPTION_3,
  MOCK_SUBSCRIPTION_4,
} from "@/app/test-utils/mock-subscription";
import { verifyStatusAndBody } from "@/app/test-utils/next-response-helper";
import { GET, DELETE, POST } from "@/app/api/subscriptions/route";
import { NextRequest } from "next/server";
import { serializeToJsonString } from "@/app/utils/serialization";
import {
  removeTargetAndDeleteRule,
  createEventBridgeResources,
} from "@/app/utils/eventbridge";
import { deleteQueue } from "@/app/utils/sqs";
import {
  createEventBridgeDestination,
  getEventBridgeDestinations,
} from "@/app/utils/destination";
import {
  MOCK_CREATE_DESTINATION_RESPONSE,
  MOCK_DESTINATION,
} from "@/app/test-utils/mock-destination";
import { headers } from "next/dist/client/components/headers";
import { afterEach } from "@jest/globals";
import { instance, reset, when, mock } from "ts-mockito";
import { NOTIFICATION_TYPE_HEADER } from "@/app/constants/global";
import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

// @ts-ignore
const mockReadOnlyHeaders: ReadonlyHeaders = mock(ReadonlyHeaders);

jest.mock("next/dist/client/components/headers");
const mockedHeaders = jest.mocked(headers);

jest.mock("@/app/utils/eventbridge");
const mockedRemoveTargetAndDeleteRule = jest.mocked(removeTargetAndDeleteRule);
const mockedCreateEventBridgeResources = jest.mocked(
  createEventBridgeResources,
);
jest.mock("@/app/utils/sqs");
const mockedDeleteQueue = jest.mocked(deleteQueue);

jest.mock("@/app/utils/subscription");
const mockedGetDisplayableListingSubscriptions = jest.mocked(
  getDisplayableListingSubscriptions,
);
const mockedDeleteSubscription = jest.mocked(deleteSubscription);
jest.mock("@/app/utils/destination");
const mockedGetEventBridgeDestination = jest.mocked(getEventBridgeDestinations);
const mockedCreateEventBridgeDestination = jest.mocked(
  createEventBridgeDestination,
);
const mockedCreateSubscription = jest.mocked(createSubscription);
const LISC_NOTIFICATION = "LISTINGS_ITEM_STATUS_CHANGE";

jest.mock("@/app/api/settings/wrapper");
const mockedGetSettings = jest.mocked(getSettings);
function mockSettings(status: number) {
  mockedGetSettings.mockResolvedValue({
    status: status,
    statusText: "Some Status Text",
    settings: MOCK_SETTINGS,
  });
}

function mockHeaders(notificationType?: string) {
  notificationType &&
    when(mockReadOnlyHeaders.get(NOTIFICATION_TYPE_HEADER)).thenReturn(
      LISC_NOTIFICATION,
    );
  mockedHeaders.mockReturnValue(instance(mockReadOnlyHeaders));
}

describe("Test for the subscriptions API", () => {
  describe("Test for the GET subscriptions API", () => {
    beforeEach(() => {
      fetch.resetMocks();
    });

    test("returns 200 on successful case", async () => {
      mockSettings(200);
      mockedGetDisplayableListingSubscriptions.mockResolvedValue([
        MOCK_SUBSCRIPTION_1,
        MOCK_SUBSCRIPTION_2,
      ]);

      await verifyStatusAndBody(await GET(), 200, true);
    });

    test("returns 500 on settings failure", async () => {
      mockSettings(400);
      await verifyStatusAndBody(await GET(), 500, false);
    });

    test("returns 409 on runtime error", async () => {
      mockSettings(200);
      mockedGetDisplayableListingSubscriptions.mockRejectedValue({
        status: 409,
      });
      await verifyStatusAndBody(await GET(), 409, true);
    });
  });

  describe("Test for the DELETE subscriptions API", () => {
    beforeEach(() => {
      fetch.resetMocks();
    });

    function buildDeleteNextRequest(body: any) {
      return new NextRequest("http://localhost:3000/api/subscriptions", {
        method: "DELETE",
        body: serializeToJsonString(body),
      });
    }

    test("returns 200 on successful case", async () => {
      mockSettings(200);
      mockedDeleteSubscription.mockImplementationOnce(() => Promise.resolve());
      mockedRemoveTargetAndDeleteRule.mockImplementationOnce(() =>
        Promise.resolve(),
      );
      mockedDeleteQueue.mockImplementationOnce(() => Promise.resolve());

      await verifyStatusAndBody(
        await DELETE(buildDeleteNextRequest(MOCK_SUBSCRIPTION_3)),
        200,
        false,
      );
      expect(mockedDeleteSubscription.mock.calls.length).toStrictEqual(1);
      expect(mockedRemoveTargetAndDeleteRule.mock.calls.length).toStrictEqual(
        1,
      );
      expect(mockedDeleteQueue.mock.calls.length).toStrictEqual(1);
    });

    test("returns 200 on subscription with no targetId and queue", async () => {
      mockSettings(200);
      mockedDeleteSubscription.mockImplementationOnce(() => Promise.resolve());

      await verifyStatusAndBody(
        await DELETE(buildDeleteNextRequest(MOCK_SUBSCRIPTION_4)),
        200,
        false,
      );
      expect(mockedDeleteSubscription.mock.calls.length).toStrictEqual(1);
      expect(mockedRemoveTargetAndDeleteRule.mock.calls.length).toStrictEqual(
        0,
      );
      expect(mockedDeleteQueue.mock.calls.length).toStrictEqual(0);
    });

    test("returns 500 on AWS resource deletion failure", async () => {
      mockSettings(200);
      mockedRemoveTargetAndDeleteRule.mockRejectedValue({
        status: 500,
      });

      await verifyStatusAndBody(
        await DELETE(buildDeleteNextRequest(MOCK_SUBSCRIPTION_3)),
        500,
        false,
      );
      expect(mockedDeleteSubscription.mock.calls.length).toStrictEqual(0);
      expect(mockedRemoveTargetAndDeleteRule.mock.calls.length).toStrictEqual(
        1,
      );
      expect(mockedDeleteQueue.mock.calls.length).toStrictEqual(0);
    });

    test("returns 503 on successful aws resource deletion and unsuccessful subscription deletion", async () => {
      mockSettings(200);
      mockedDeleteSubscription.mockRejectedValue({
        status: 503,
      });
      mockedRemoveTargetAndDeleteRule.mockImplementationOnce(() =>
        Promise.resolve(),
      );
      mockedDeleteQueue.mockImplementationOnce(() => Promise.resolve());

      await verifyStatusAndBody(
        await DELETE(buildDeleteNextRequest(MOCK_SUBSCRIPTION_3)),
        503,
        false,
      );
      expect(mockedDeleteSubscription.mock.calls.length).toStrictEqual(1);
      expect(mockedRemoveTargetAndDeleteRule.mock.calls.length).toStrictEqual(
        1,
      );
      expect(mockedDeleteQueue.mock.calls.length).toStrictEqual(1);
    });

    test("returns 500 on settings failure", async () => {
      mockSettings(400);
      await verifyStatusAndBody(
        await DELETE(buildDeleteNextRequest(MOCK_SUBSCRIPTION_3)),
        500,
        false,
      );
    });

    test("returns 400 on invalid subscription in body", async () => {
      mockSettings(200);
      await verifyStatusAndBody(
        await DELETE(buildDeleteNextRequest({})),
        400,
        false,
      );
    });

    test("returns 400 on invalid json in body", async () => {
      mockSettings(200);
      await verifyStatusAndBody(
        await DELETE(buildDeleteNextRequest("")),
        400,
        false,
      );
    });
  });

  describe("Test for the POST subscriptions API", () => {
    beforeEach(() => {
      fetch.resetMocks();
      jest.clearAllMocks();
    });

    afterEach(() => {
      reset(mockReadOnlyHeaders);
    });

    test("returns 200 on successful case from existing destination", async () => {
      mockSettings(200);
      mockHeaders(LISC_NOTIFICATION);
      mockedGetEventBridgeDestination.mockResolvedValue([MOCK_DESTINATION]);
      mockedCreateEventBridgeResources.mockImplementationOnce(() =>
        Promise.resolve(),
      );
      mockedCreateSubscription.mockResolvedValue(
        MOCK_CREATE_SUBSCRIPTION_SP_API_RESPONSE,
      );

      await verifyStatusAndBody(await POST(), 200, true);
      expect(mockedGetEventBridgeDestination.mock.calls.length).toStrictEqual(
        1,
      );
      expect(
        mockedCreateEventBridgeDestination.mock.calls.length,
      ).toStrictEqual(0);
      expect(mockedCreateEventBridgeResources.mock.calls.length).toStrictEqual(
        1,
      );
      expect(mockedCreateSubscription.mock.calls.length).toStrictEqual(1);
    });

    test("returns 200 on successful case from create new destination", async () => {
      mockSettings(200);
      mockHeaders(LISC_NOTIFICATION);
      mockedGetEventBridgeDestination.mockResolvedValue([]);
      mockedCreateEventBridgeDestination.mockResolvedValue(
        MOCK_CREATE_DESTINATION_RESPONSE,
      );
      mockedCreateEventBridgeResources.mockImplementationOnce(() =>
        Promise.resolve(),
      );
      mockedCreateSubscription.mockResolvedValue(
        MOCK_CREATE_SUBSCRIPTION_SP_API_RESPONSE,
      );

      await verifyStatusAndBody(await POST(), 200, true);

      expect(mockedGetEventBridgeDestination.mock.calls.length).toStrictEqual(
        1,
      );
      expect(
        mockedCreateEventBridgeDestination.mock.calls.length,
      ).toStrictEqual(1);
      expect(mockedCreateEventBridgeResources.mock.calls.length).toStrictEqual(
        1,
      );
      expect(mockedCreateSubscription.mock.calls.length).toStrictEqual(1);
    });

    test("returns 500 on settings failure", async () => {
      mockSettings(400);

      await verifyStatusAndBody(await POST(), 500, false);
      expect(mockedGetEventBridgeDestination.mock.calls.length).toStrictEqual(
        0,
      );
      expect(
        mockedCreateEventBridgeDestination.mock.calls.length,
      ).toStrictEqual(0);
      expect(mockedCreateEventBridgeResources.mock.calls.length).toStrictEqual(
        0,
      );
      expect(mockedCreateSubscription.mock.calls.length).toStrictEqual(0);
    });

    test("returns 400 exception from missing Notification Type header from Create Subscription API", async () => {
      mockSettings(200);
      mockHeaders(undefined);

      await verifyStatusAndBody(await POST(), 400, false);
      expect(mockedGetEventBridgeDestination.mock.calls.length).toStrictEqual(
        0,
      );
      expect(
        mockedCreateEventBridgeDestination.mock.calls.length,
      ).toStrictEqual(0);
      expect(mockedCreateEventBridgeResources.mock.calls.length).toStrictEqual(
        0,
      );
      expect(mockedCreateSubscription.mock.calls.length).toStrictEqual(0);
    });

    test("returns 400 on 400 from GetEventBridge Destination call when invoking the CreateSubscription call", async () => {
      mockSettings(200);
      mockHeaders(LISC_NOTIFICATION);
      mockedGetEventBridgeDestination.mockRejectedValue({
        status: 400,
      });

      await verifyStatusAndBody(await POST(), 400, true);
      expect(mockedGetEventBridgeDestination.mock.calls.length).toStrictEqual(
        1,
      );
      expect(
        mockedCreateEventBridgeDestination.mock.calls.length,
      ).toStrictEqual(0);
      expect(mockedCreateEventBridgeResources.mock.calls.length).toStrictEqual(
        0,
      );
      expect(mockedCreateSubscription.mock.calls.length).toStrictEqual(0);
    });

    test("returns 400 on 400 from invoking CreateSubscription API", async () => {
      mockSettings(200);
      mockHeaders(LISC_NOTIFICATION);
      mockedGetEventBridgeDestination.mockResolvedValue([]);
      mockedCreateEventBridgeDestination.mockResolvedValue(
        MOCK_CREATE_DESTINATION_RESPONSE,
      );
      mockedCreateEventBridgeResources.mockImplementationOnce(() =>
        Promise.resolve(),
      );
      mockedCreateSubscription.mockRejectedValue({
        status: 400,
      });

      await verifyStatusAndBody(await POST(), 400, true);
      expect(mockedGetEventBridgeDestination.mock.calls.length).toStrictEqual(
        1,
      );
      expect(
        mockedCreateEventBridgeDestination.mock.calls.length,
      ).toStrictEqual(1);
      expect(mockedCreateEventBridgeResources.mock.calls.length).toStrictEqual(
        0,
      );
      expect(mockedCreateSubscription.mock.calls.length).toStrictEqual(1);
    });

    test("returns 200 for 409 response from CreateSubscription API", async () => {
      mockSettings(200);
      mockHeaders(LISC_NOTIFICATION);
      mockedGetEventBridgeDestination.mockResolvedValue([]);
      mockedCreateEventBridgeDestination.mockResolvedValue(
        MOCK_CREATE_DESTINATION_RESPONSE,
      );
      mockedCreateEventBridgeResources.mockImplementationOnce(() =>
        Promise.resolve(),
      );
      mockedCreateSubscription.mockRejectedValue({
        status: 409,
      });

      await verifyStatusAndBody(await POST(), 200, true);

      expect(mockedGetEventBridgeDestination.mock.calls.length).toStrictEqual(
        1,
      );
      expect(
        mockedCreateEventBridgeDestination.mock.calls.length,
      ).toStrictEqual(1);
      expect(mockedCreateEventBridgeResources.mock.calls.length).toStrictEqual(
        0,
      );
      expect(mockedCreateSubscription.mock.calls.length).toStrictEqual(1);
    });
  });
});
