import { mockClient } from "aws-sdk-client-mock";
import {
  DeleteRuleCommand,
  EventBridge,
  InternalException,
  ListRulesCommand,
  ListTargetsByRuleCommand,
  RemoveTargetsCommand,
  CreateEventBusCommand,
  PutRuleCommand,
  ResourceNotFoundException,
  RuleState,
  ResourceAlreadyExistsException,
  PutTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  createEventBridgeResources,
  getRuleTargetsForEventBus,
  removeTargetAndDeleteRule,
} from "@/app/utils/eventbridge";
import { CreateQueueCommand, SQS } from "@aws-sdk/client-sqs";

const NEXT_TOKEN = "b9ed7a90-3ca8-4558-9886-363527caaf7a";
const EVENT_BUS_NAME =
  "sellingpartnerapi.amazon.com/amzn1.sellerapps.app.15a75829-cd4a-4efc-b947-0cc39d874577";
const BICC_NOTIFICATION_TYPE = "BRANDED_ITEM_CONTENT_CHANGE";
const EVENT_BUS_RULE_DESCRIPTION = "Description";
const EVENT_BUS_RULE_PATTERN = "Pattern";
const REGION = "us-east-1";
const BICC_RULE = "BrandedItemContentChangeRule";
const IPTC_RULE = "ItemProductTypeChangeRule";
const BICC_TARGET = "BrandedItemContentChangeTarget";
const IPTC_TARGET = "ItemProductTypeChangeTarget";
const BICC_QUEUE =
  "arn:aws:sqs:us-east-1:444455556666:BrandedItemContentChangeQueue";
const IPTC_QUEUE =
  "arn:aws:sqs:us-east-1:444455556666:ItemProductTypeChangeQueue";
const AWS_ACCOUNT_ID = "123456789";
const QUEUE_NAME = "TestQueue";

const mockedEventBridge = mockClient(EventBridge);
const mockedSQS = mockClient(SQS);

describe("Test for the eventbridge", () => {
  describe("Test for the getRuleTargetsForEventBus", () => {
    beforeEach(() => {
      mockedEventBridge.reset();
    });

    test("snapshot test for the 200 responses from AWS API", async () => {
      mockedEventBridge
        .on(ListRulesCommand, {
          EventBusName: EVENT_BUS_NAME,
          NextToken: undefined,
        })
        .resolves({
          NextToken: NEXT_TOKEN,
          Rules: [
            {
              Name: BICC_RULE,
              EventBusName: EVENT_BUS_NAME,
            },
          ],
        })
        .on(ListRulesCommand, {
          EventBusName: EVENT_BUS_NAME,
          NextToken: NEXT_TOKEN,
        })
        .resolves({
          NextToken: undefined,
          Rules: [
            {
              Name: IPTC_RULE,
              EventBusName: EVENT_BUS_NAME,
            },
          ],
        });

      mockedEventBridge
        .on(ListTargetsByRuleCommand, {
          EventBusName: EVENT_BUS_NAME,
          Rule: BICC_RULE,
          NextToken: undefined,
        })

        .resolves({
          NextToken: undefined,
          Targets: [
            {
              Id: BICC_TARGET,
              Arn: BICC_QUEUE,
            },
          ],
        })
        .on(ListTargetsByRuleCommand, {
          EventBusName: EVENT_BUS_NAME,
          Rule: IPTC_RULE,
          NextToken: undefined,
        })
        .resolves({
          NextToken: undefined,
          Targets: [
            {
              Id: IPTC_TARGET,
              Arn: IPTC_QUEUE,
            },
          ],
        });

      const ruleTargets = await getRuleTargetsForEventBus(
        REGION,
        EVENT_BUS_NAME,
      );
      expect(ruleTargets).toMatchSnapshot();
    });

    test("test for the 404 response from the AWS API", async () => {
      mockedEventBridge.on(ListRulesCommand).rejects(
        new ResourceNotFoundException({
          message: "The event bus doesn't exist",
          $metadata: {
            httpStatusCode: 404,
          },
        }),
      );
      const ruleTargets: any[] = await getRuleTargetsForEventBus(
        REGION,
        EVENT_BUS_NAME,
      );
      expect(ruleTargets.length).toStrictEqual(0);
    });
  });

  describe("Test for the removeTargetAndDeleteRule", () => {
    beforeEach(() => {
      mockedEventBridge.reset();
    });

    test("removes target and deletes rule successfully", async () => {
      mockedEventBridge
        .on(RemoveTargetsCommand, {
          EventBusName: EVENT_BUS_NAME,
          Rule: IPTC_RULE,
          Ids: [IPTC_TARGET],
        })
        .resolves({
          FailedEntryCount: 0,
        })
        .on(DeleteRuleCommand, {
          EventBusName: EVENT_BUS_NAME,
          Name: IPTC_RULE,
        })
        .resolves({});

      await removeTargetAndDeleteRule(
        EVENT_BUS_NAME,
        IPTC_RULE,
        IPTC_TARGET,
        REGION,
      );
    });

    test("returns successfully on resource not found", async () => {
      mockedEventBridge
        .on(RemoveTargetsCommand, {
          EventBusName: EVENT_BUS_NAME,
          Rule: IPTC_RULE,
          Ids: [IPTC_TARGET],
        })
        .rejects(
          new ResourceNotFoundException({
            message: "TargetId doesn't exist",
            $metadata: {
              httpStatusCode: 404,
            },
          }),
        )
        .on(DeleteRuleCommand, {
          EventBusName: EVENT_BUS_NAME,
          Name: IPTC_RULE,
        })
        .rejects(
          new ResourceNotFoundException({
            message: "Rule doesn't exist",
            $metadata: {
              httpStatusCode: 404,
            },
          }),
        );

      await removeTargetAndDeleteRule(
        EVENT_BUS_NAME,
        IPTC_RULE,
        IPTC_TARGET,
        REGION,
      );
    });

    test("throws error on non zero failed entry count from remove targets", async () => {
      mockedEventBridge
        .on(RemoveTargetsCommand, {
          EventBusName: EVENT_BUS_NAME,
          Rule: IPTC_RULE,
          Ids: [IPTC_TARGET],
        })
        .resolves({
          FailedEntryCount: 1,
          FailedEntries: [
            {
              ErrorCode: "ConcurrentModificationException",
              ErrorMessage: "Too many requests made at the same time",
              TargetId: IPTC_TARGET,
            },
          ],
        });

      await expect(
        removeTargetAndDeleteRule(
          EVENT_BUS_NAME,
          IPTC_RULE,
          IPTC_TARGET,
          REGION,
        ),
      ).rejects.toMatchObject({
        status: 500,
      });
    });

    test("throws error on internal exception from remove targets", async () => {
      mockedEventBridge
        .on(RemoveTargetsCommand, {
          EventBusName: EVENT_BUS_NAME,
          Rule: IPTC_RULE,
          Ids: [IPTC_TARGET],
        })
        .rejects(
          new InternalException({
            message: "Internal Server Error",
            $metadata: {
              httpStatusCode: 500,
            },
          }),
        );

      await expect(
        removeTargetAndDeleteRule(
          EVENT_BUS_NAME,
          IPTC_RULE,
          IPTC_TARGET,
          REGION,
        ),
      ).rejects.toMatchObject({
        status: 500,
      });
    });

    test("throws error on internal exception from delete rule", async () => {
      mockedEventBridge
        .on(RemoveTargetsCommand, {
          EventBusName: EVENT_BUS_NAME,
          Rule: IPTC_RULE,
          Ids: [IPTC_TARGET],
        })
        .resolves({
          FailedEntryCount: 0,
        })
        .on(DeleteRuleCommand, {
          EventBusName: EVENT_BUS_NAME,
          Name: IPTC_RULE,
        })
        .rejects(
          new InternalException({
            message: "Internal Server Error",
            $metadata: {
              httpStatusCode: 500,
            },
          }),
        );

      await expect(
        removeTargetAndDeleteRule(
          EVENT_BUS_NAME,
          IPTC_RULE,
          IPTC_TARGET,
          REGION,
        ),
      ).rejects.toMatchObject({
        status: 500,
      });
    });
  });

  describe("Test for the createEventBridgeResources", () => {
    beforeEach(() => {
      mockedEventBridge.reset();
      mockedSQS.reset();
    });

    test("Creates EventBus resources successfully", async () => {
      mockedEventBridge
        .on(CreateEventBusCommand, {
          Name: EVENT_BUS_NAME,
          EventSourceName: EVENT_BUS_NAME,
        })
        .resolves({})
        .on(PutRuleCommand, {
          Name: BICC_RULE,
          EventBusName: EVENT_BUS_NAME,
          Description: EVENT_BUS_RULE_DESCRIPTION,
          EventPattern: EVENT_BUS_RULE_PATTERN,
          State: RuleState.ENABLED,
        })
        .resolves({})
        .on(PutTargetsCommand)
        .resolves({
          FailedEntryCount: 0,
        });
      mockedSQS
        .on(CreateQueueCommand, {
          QueueName: QUEUE_NAME,
        })
        .resolves({});

      await createEventBridgeResources(
        EVENT_BUS_NAME,
        BICC_NOTIFICATION_TYPE,
        AWS_ACCOUNT_ID,
        REGION,
      );
    });

    test("Creates EventBus resources successfully - EventBus already exists", async () => {
      mockedEventBridge
        .on(CreateEventBusCommand, {
          Name: EVENT_BUS_NAME,
          EventSourceName: EVENT_BUS_NAME,
        })
        .rejects(
          new ResourceAlreadyExistsException({
            message: "EventBus already exists",
            $metadata: {
              httpStatusCode: 400,
            },
          }),
        )
        .on(PutRuleCommand, {
          Name: BICC_RULE,
          EventBusName: EVENT_BUS_NAME,
          Description: EVENT_BUS_RULE_DESCRIPTION,
          EventPattern: EVENT_BUS_RULE_PATTERN,
          State: RuleState.ENABLED,
        })
        .resolves({})
        .on(PutTargetsCommand)
        .resolves({
          FailedEntryCount: 0,
        });
      mockedSQS
        .on(CreateQueueCommand, {
          QueueName: QUEUE_NAME,
        })
        .resolves({});

      await createEventBridgeResources(
        EVENT_BUS_NAME,
        BICC_NOTIFICATION_TYPE,
        AWS_ACCOUNT_ID,
        REGION,
      );
    });

    test("Creates EventBus resources successfully - EventBus does not exist", async () => {
      mockedEventBridge
        .on(CreateEventBusCommand, {
          Name: EVENT_BUS_NAME,
          EventSourceName: EVENT_BUS_NAME,
        })
        .rejects(
          new ResourceNotFoundException({
            message: "EventBus does not exist",
            $metadata: {
              httpStatusCode: 404,
            },
          }),
        )
        .on(PutRuleCommand, {
          Name: BICC_RULE,
          EventBusName: EVENT_BUS_NAME,
          Description: EVENT_BUS_RULE_DESCRIPTION,
          EventPattern: EVENT_BUS_RULE_PATTERN,
          State: RuleState.ENABLED,
        })
        .resolves({})
        .on(PutTargetsCommand)
        .resolves({
          FailedEntryCount: 0,
        });
      mockedSQS
        .on(CreateQueueCommand, {
          QueueName: QUEUE_NAME,
        })
        .resolves({});

      await createEventBridgeResources(
        EVENT_BUS_NAME,
        BICC_NOTIFICATION_TYPE,
        AWS_ACCOUNT_ID,
        REGION,
      );
    });

    test("Creates EventBus resources successfully - Rule Already Exists", async () => {
      mockedEventBridge
        .on(CreateEventBusCommand, {
          Name: EVENT_BUS_NAME,
          EventSourceName: EVENT_BUS_NAME,
        })
        .resolves({})
        .on(PutRuleCommand)
        .rejects(
          new ResourceAlreadyExistsException({
            message: "Event Bus Rule already exists",
            $metadata: {
              httpStatusCode: 400,
            },
          }),
        )
        .on(PutTargetsCommand)
        .resolves({
          FailedEntryCount: 0,
        });
      mockedSQS
        .on(CreateQueueCommand, {
          QueueName: QUEUE_NAME,
        })
        .resolves({});

      await createEventBridgeResources(
        EVENT_BUS_NAME,
        BICC_NOTIFICATION_TYPE,
        AWS_ACCOUNT_ID,
        REGION,
      );
    });

    test(
      "Creates EventBus resources returns 500 responses from AWS API - " +
        "InternalException for Put Rule",
      async () => {
        mockedEventBridge
          .on(CreateEventBusCommand, {
            Name: EVENT_BUS_NAME,
            EventSourceName: EVENT_BUS_NAME,
          })
          .resolves({})
          .on(PutRuleCommand)
          .rejects(
            new InternalException({
              message: "Rule cannot be created due to unexpected causes",
              $metadata: {
                httpStatusCode: 500,
              },
            }),
          )
          .on(PutTargetsCommand)
          .resolves({
            FailedEntryCount: 0,
          });
        mockedSQS
          .on(CreateQueueCommand, {
            QueueName: QUEUE_NAME,
          })
          .resolves({});

        await expect(
          createEventBridgeResources(
            EVENT_BUS_NAME,
            BICC_NOTIFICATION_TYPE,
            AWS_ACCOUNT_ID,
            REGION,
          ),
        ).rejects.toMatchObject({
          status: 500,
        });
      },
    );

    test(
      "Creates EventBus resources returns 500 responses from AWS API - " +
        "InternalException for Put Targets Request",
      async () => {
        mockedEventBridge
          .on(CreateEventBusCommand, {
            Name: EVENT_BUS_NAME,
            EventSourceName: EVENT_BUS_NAME,
          })
          .resolves({})
          .on(PutRuleCommand, {
            Name: BICC_RULE,
            EventBusName: EVENT_BUS_NAME,
            Description: EVENT_BUS_RULE_DESCRIPTION,
            EventPattern: EVENT_BUS_RULE_PATTERN,
            State: RuleState.ENABLED,
          })
          .resolves({})
          .on(PutTargetsCommand)
          .rejects(
            new InternalException({
              message: "Rule cannot be created due to unexpected causes",
              $metadata: {
                httpStatusCode: 500,
              },
            }),
          );
        mockedSQS
          .on(CreateQueueCommand, {
            QueueName: QUEUE_NAME,
          })
          .resolves({});

        await expect(
          createEventBridgeResources(
            EVENT_BUS_NAME,
            BICC_NOTIFICATION_TYPE,
            AWS_ACCOUNT_ID,
            REGION,
          ),
        ).rejects.toMatchObject({
          status: 500,
        });
      },
    );

    test(
      "Creates EventBus resources returns 500 responses from AWS API - " +
        "Partial failure for Put Targets Request",
      async () => {
        mockedEventBridge
          .on(CreateEventBusCommand, {
            Name: EVENT_BUS_NAME,
            EventSourceName: EVENT_BUS_NAME,
          })
          .resolves({})
          .on(PutRuleCommand, {
            Name: BICC_RULE,
            EventBusName: EVENT_BUS_NAME,
            Description: EVENT_BUS_RULE_DESCRIPTION,
            EventPattern: EVENT_BUS_RULE_PATTERN,
            State: RuleState.ENABLED,
          })
          .resolves({})
          .on(PutTargetsCommand)
          .resolves({
            FailedEntryCount: 1,
            FailedEntries: [
              {
                ErrorCode: "ConcurrentModificationException",
                ErrorMessage: "Too many requests made at the same time",
                TargetId: IPTC_TARGET,
              },
            ],
          });
        mockedSQS
          .on(CreateQueueCommand, {
            QueueName: QUEUE_NAME,
          })
          .resolves({});

        await expect(
          createEventBridgeResources(
            EVENT_BUS_NAME,
            BICC_NOTIFICATION_TYPE,
            AWS_ACCOUNT_ID,
            REGION,
          ),
        ).rejects.toMatchObject({
          status: 500,
        });
      },
    );
  });
});
