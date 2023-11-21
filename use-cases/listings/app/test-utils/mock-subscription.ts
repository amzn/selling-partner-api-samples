import { Subscription } from "@/app/model/types";
import {
  CREATE_SUBSCRIPTION_API_DOC_LINK,
  CREATE_SUBSCRIPTION_API_NAME,
} from "@/app/constants/global";

export const MOCK_SUBSCRIPTION_1: Subscription = {
  subscriptionId: "f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454",
  notificationType: "BRANDED_ITEM_CONTENT_CHANGE",
  eventBusName: "TestEventBus",
  eventBusFilterRule: "SellingPartnerNotificationsAPIRule",
  sqsQueueName: "BrandedItemContentChange",
};

export const MOCK_SUBSCRIPTION_2: Subscription = {
  subscriptionId: "510f082f-a853-4847-acf2-475641cb7b06",
  notificationType: "PRODUCT_TYPE_DEFINITIONS_CHANGE",
  eventBusName: "TestEventBus1",
  eventBusFilterRule: "SellingPartnerNotificationsAPIRule",
  sqsQueueName: "ProductTypeDefinitionsChange",
};

export const MOCK_SUBSCRIPTION_3: Subscription = {
  subscriptionId: "510f082f-a853-4847-acf2-475641cb7b06",
  notificationType: "PRODUCT_TYPE_DEFINITIONS_CHANGE",
  eventBusName: "TestEventBus1",
  eventBusFilterRule: "SellingPartnerNotificationsAPIRule",
  sqsTargetId: "ProductTypeDefinitionsTarget",
  sqsQueueName: "ProductTypeDefinitionsChange",
};

export const MOCK_SUBSCRIPTION_4: Subscription = {
  subscriptionId: "510f082f-a853-4847-acf2-475641cb7b06",
  notificationType: "PRODUCT_TYPE_DEFINITIONS_CHANGE",
  eventBusName: "TestEventBus1",
  eventBusFilterRule: "SellingPartnerNotificationsAPIRule",
};

export const MOCK_CREATE_SUBSCRIPTION_RESULT_1 = {
  subscriptionId: "510f082f-a853-4847-acf2-475641cb7b06",
  payloadVersion: "1.0",
  destinationId: "testDestinationId",
};

export const MOCK_CREATE_SUBSCRIPTION_SP_API_RESPONSE = {
  apiName: CREATE_SUBSCRIPTION_API_NAME,
  apiDocumentationLink: CREATE_SUBSCRIPTION_API_DOC_LINK,
  request: {
    body: {
      payloadVersion: "1",
      destinationId: "testDestinationId",
    },
    notificationType: "LISTINGS_ITEM_STATUS_CHANGE",
  },
  response: MOCK_CREATE_SUBSCRIPTION_RESULT_1,
};
