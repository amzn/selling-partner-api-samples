import { mockClient } from "aws-sdk-client-mock";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  ResourceNotFoundException,
  SQS,
  UnsupportedOperation,
} from "@aws-sdk/client-sqs";
import { createQueue, deleteQueue } from "@/app/utils/sqs";

const AWS_ACCOUNT_ID = "123456";
const REGION = "us-east-1";
const QUEUE_NAME = "TestQueue";
const BICC_NOTIFICATION = "BRANDED_ITEM_CONTENT_CHANGE";
const mockedSQS = mockClient(SQS);
const SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123456/TestQueue";
const EVENT_BUS_NAME = "EventBus";
describe("Test for the sqs", () => {
  describe("Test for the deleteQueue", () => {
    beforeEach(() => {
      mockedSQS.reset();
    });

    test("deletes queue successfully", async () => {
      mockedSQS
        .on(DeleteQueueCommand, {
          QueueUrl: SQS_QUEUE_URL,
        })
        .resolves({});

      await deleteQueue(AWS_ACCOUNT_ID, REGION, QUEUE_NAME);
    });

    test("returns successfully on ResourceNotFoundException", async () => {
      mockedSQS
        .on(DeleteQueueCommand, {
          QueueUrl: SQS_QUEUE_URL,
        })
        .rejects(
          new ResourceNotFoundException({
            message: "Queue doesn't exist",
            $metadata: {
              httpStatusCode: 400,
            },
          }),
        );
      await deleteQueue(AWS_ACCOUNT_ID, REGION, QUEUE_NAME);
    });

    test("throws error on UnsupportedOperation", async () => {
      mockedSQS
        .on(DeleteQueueCommand, {
          QueueUrl: SQS_QUEUE_URL,
        })
        .rejects(
          new UnsupportedOperation({
            message: "Queue doesn't exist",
            $metadata: {
              httpStatusCode: 400,
            },
          }),
        );
      await expect(
        deleteQueue(AWS_ACCOUNT_ID, REGION, QUEUE_NAME),
      ).rejects.toMatchObject({
        status: 500,
      });
    });
  });

  describe("Test for the createQueue", () => {
    beforeEach(() => {
      mockedSQS.reset();
    });

    test("create queue successfully", async () => {
      mockedSQS
        .on(CreateQueueCommand, {
          QueueName: QUEUE_NAME,
        })
        .resolves({});

      await createQueue(
        BICC_NOTIFICATION,
        REGION,
        AWS_ACCOUNT_ID,
        EVENT_BUS_NAME,
      );
    });

    test("throws error on UnsupportedOperation", async () => {
      mockedSQS.on(CreateQueueCommand).rejects(
        new UnsupportedOperation({
          message: "Queue already exists",
          $metadata: {
            httpStatusCode: 400,
          },
        }),
      );

      await expect(
        createQueue(BICC_NOTIFICATION, REGION, AWS_ACCOUNT_ID, EVENT_BUS_NAME),
      ).rejects.toMatchObject({
        status: 500,
      });
    });
  });
});
