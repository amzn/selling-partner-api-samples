import * as cdk from 'aws-cdk-lib';
import {DefaultStackSynthesizer} from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';

export interface SpApiAppCdkStackProps extends cdk.StackProps {
  readonly randomSuffix: string;
  readonly spApiCdkQualifier: string;
}

/**
 * This template creates the resources of an SP-API application
 */
export class SpApiAppCdkStack extends cdk.Stack {
  public constructor(scope: cdk.App, id: string, props: SpApiAppCdkStackProps) {
    super(scope, id.concat("-", props.randomSuffix), {
      ...props, synthesizer: new DefaultStackSynthesizer({
          qualifier: props.spApiCdkQualifier
      })
  });

    //Parameters
  const clientId = new cdk.CfnParameter(this, 'clientID', {
      type: 'String',
      noEcho: true,
      description: "Client Id of the SP-API app"
  });

  const clientSecret = new cdk.CfnParameter(this, 'clientSecret', {
      type: 'String',
      noEcho: true,
      description: "Client Secret of the SP-API app"
  });

  const programmingLanguage = new cdk.CfnParameter(this, 'programmingLanguage', {
      type: 'String',
      description: 'Programming language of the Lambda functions'
  });

  const refreshToken = new cdk.CfnParameter(this, 'refreshToken', {
    type: 'String',
    noEcho: true,
    description: 'Refresh Token used for testing the SP-API app'
  });

  const regionCode = new cdk.CfnParameter(this, 'regionCode', {
    type: 'String',
    noEcho: true,
    description: 'Region Code used for testing the SP-API app'
  });

  const artifactsS3BucketName = new cdk.CfnParameter(this, 'artifactS3BucketName', {
    type: 'String',
    description: "Name of the S3 bucket containing the application's artifacts"
  });

  const lambdaFunctionsCodeS3Key = new cdk.CfnParameter(this, 'lambdaFunctionCodeS3Key', {
    type: 'String',
    description: "Key of the S3 file containing the Lambda functions code"
  });

  const stepFunctionsStateMachineDefinitionS3Key = new cdk.CfnParameter(this, 'stepFunctionStateMachineDefinitionS3Key', {
    type: 'String',
    description: "Key of the S3 file containing the Step Functions state machine definition"
  });

  const spapiCheckSkuLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiCheckSkuLambdaFunctionHandler', {
    type: 'String',
    description: "Handler of Process Notification Lambda Function"
  });

  const spapiProcessNotificationLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiProcessNotificationLambdaFunctionHandler', {
    type: 'String',
    description: "Handler of Process Notification Lambda Function"
  });

  const spapiSubscribeNotificationsLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiSubscribeNotificationsLambdaFunctionHandler', {
    type: 'String',
    description: "Handler of Subscribe Notifications Lambda Function"
  });

  const spapiFetchPriceLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiFetchPriceLambdaFunctionHandler', {
    type: 'String',
    description: "Handler of Fetching Price information Lambda Function"
  });

  const spapiCalculateNewPriceLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiCalculateNewPriceLambdaFunctionHandler', {
    type: 'String',
    description: "Handler of Updating Price information Lambda Function"
  });

  const spapiSubmitPriceLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiSubmitPriceLambdaFunctionHandler', {
    type: 'String',
    description: "Handler of Submitting Price information Lambda Function"
  });

    // Resources
    const spapiAppCredentials = new secretsmanager.CfnSecret(this, 'SPAPIAppCredentials', {
      name: [
        'SPAPIAppCredentials',
        props.randomSuffix!,
      ].join('-'),
      description: 'Secret containing SP-API app credentials',
      secretString: `{"AppClientId": "${clientId.valueAsString!}", "AppClientSecret": "${clientSecret.valueAsString!}"}`,
    });

    const spapiNotificationsDeadLetterQueue = new sqs.CfnQueue(this, 'SPAPINotificationsDeadLetterQueue', {
      queueName: [
        'sp-api-notifications-dead-letter-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 60,
    });

    const spapiSellerItemsTable = new dynamodb.CfnTable(this, 'SPAPISellerItemsTable', {
      tableName: [
        'SPAPISellerItemsTable',
        props.randomSuffix!,
      ].join('-'),
      attributeDefinitions: [
        {
          attributeName: 'ASIN',
          attributeType: 'S',
        },
        {
          attributeName: 'SKU',
          attributeType: 'S',
        },
      ],
      keySchema: [
        {
          attributeName: 'ASIN',
          keyType: 'HASH',
        },
        {
          attributeName: 'SKU',
          keyType: 'RANGE',
        },
      ],
      billingMode: 'PAY_PER_REQUEST',
    });

    const spapiCheckSkuLambdaExecutionRole = new iam.CfnRole(this, 'SPAPICheckSkuLambdaExecutionRole', {
      roleName: [
        'SPAPICheckSkuLambdaExecutionRole',
        props.randomSuffix!,
      ].join('-'),
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: [
                'lambda.amazonaws.com',
              ],
            },
            Action: [
              'sts:AssumeRole',
            ],
          },
        ],
      },
      managedPolicyArns: [
        `arn:${this.partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`,
      ],
      policies: [
        {
          policyName: 'DynamoDBReaderPolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: 'dynamodb:Query',
                Resource: spapiSellerItemsTable.attrArn,
              },
            ],
          },
        },
      ],
    });

    const spapiLambdaExecutionRole = new iam.CfnRole(this, 'SPAPILambdaExecutionRole', {
      roleName: [
        'SPAPILambdaExecutionRole',
        props.randomSuffix!,
      ].join('-'),
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: [
                'lambda.amazonaws.com',
              ],
            },
            Action: [
              'sts:AssumeRole',
            ],
          },
        ],
      },
      managedPolicyArns: [
        `arn:${this.partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`,
      ],
      policies: [
        {
          policyName: 'SecretsReaderPolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: 'secretsmanager:GetSecretValue',
                Resource: [
                  spapiAppCredentials.ref,
                ],
              },
            ],
          },
        },
      ],
    });

    const spapiNotificationsQueue = new sqs.CfnQueue(this, 'SPAPINotificationsQueue', {
      queueName: [
        'sp-api-notifications-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 60,
      redrivePolicy: {
        deadLetterTargetArn: spapiNotificationsDeadLetterQueue.attrArn,
        maxReceiveCount: 3,
      },
    });

    const spapiCalculateNewPriceLambdaFunction = new lambda.CfnFunction(this, 'SPAPICalculateNewPriceLambdaFunction', {
      functionName: [
        'SPAPICalculateNewPriceLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'CalculateNew Price information Lambda Function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiCalculateNewPriceLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
        },
      },
    });

    const spapiCheckSkuLambdaFunction = new lambda.CfnFunction(this, 'SPAPICheckSkuLambdaFunction', {
      functionName: [
        'SPAPICheckSkuLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Check SKU from DB Lambda Function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiCheckSkuLambdaFunctionHandler.valueAsString!,
      role: spapiCheckSkuLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'SELLER_ITEMS_TABLE_NAME': spapiSellerItemsTable.ref,
        },
      },
    });

    const spapiFetchPriceLambdaFunction = new lambda.CfnFunction(this, 'SPAPIFetchPriceLambdaFunction', {
      functionName: [
        'SPAPIFetchPriceLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Fetch Price information Lambda Function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiFetchPriceLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'REGION_CODE': regionCode.valueAsString!,
        },
      },
    });

    const spapiNotificationsQueuePolicy = new sqs.CfnQueuePolicy(this, 'SPAPINotificationsQueuePolicy', {
      queues: [
        spapiNotificationsQueue.ref,
      ],
      policyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'SQS:SendMessage',
              'SQS:GetQueueAttributes',
            ],
            Resource: spapiNotificationsQueue.attrArn,
            Principal: {
              AWS: [
                '437568002678',
              ],
            },
          },
        ],
      },
    });

    const spapiSubmitPriceLambdaFunction = new lambda.CfnFunction(this, 'SPAPISubmitPriceLambdaFunction', {
      functionName: [
        'SPAPISubmitPriceLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Submit Price information Lambda Function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiSubmitPriceLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'REGION_CODE': regionCode.valueAsString!,
        },
      },
    });

    const spapiSubscribeNotificationsLambdaFunction = new lambda.CfnFunction(this, 'SPAPISubscribeNotificationsLambdaFunction', {
      functionName: [
        'SPAPISubscribeNotificationsLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Subscribe Notifications Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiSubscribeNotificationsLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'SQS_QUEUE_ARN': spapiNotificationsQueue.attrArn,
        },
      },
    });

    const spapiStateMachineExecutionRole = new iam.CfnRole(this, 'SPAPIStateMachineExecutionRole', {
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'states.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      policies: [
        {
          policyName: 'LambdaInvokePolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'lambda:InvokeFunction',
                ],
                Resource: [
                  spapiCheckSkuLambdaFunction.attrArn,
                  spapiFetchPriceLambdaFunction.attrArn,
                  spapiCalculateNewPriceLambdaFunction.attrArn,
                  spapiSubmitPriceLambdaFunction.attrArn,
                ],
              },
            ],
          },
        },
      ],
    });

    const spapiStateMachine = new stepfunctions.CfnStateMachine(this, 'SPAPIStateMachine', {
      stateMachineName: [
        'SPAPIStateMachine',
        props.randomSuffix!,
      ].join('-'),
      stateMachineType: 'STANDARD',
      definitionS3Location: {
        bucket: artifactsS3BucketName.valueAsString!,
        key: stepFunctionsStateMachineDefinitionS3Key.valueAsString!,
      },
      definitionSubstitutions: {
        CheckSkuLambdaFunctionHandlerArn: spapiCheckSkuLambdaFunction.attrArn,
        FetchPriceLambdaFunctionHandlerArn: spapiFetchPriceLambdaFunction.attrArn,
        CalculateNewPriceLambdaFunctionHandlerArn: spapiCalculateNewPriceLambdaFunction.attrArn,
        SubmitPriceLambdaFunctionHandlerArn: spapiSubmitPriceLambdaFunction.attrArn,
      },
      roleArn: spapiStateMachineExecutionRole.attrArn,
    });

    const spapiNotificationsLambdaExecutionRole = new iam.CfnRole(this, 'SPAPINotificationsLambdaExecutionRole', {
      roleName: [
        'SPAPINotificationsLambdaExecutionRole',
        props.randomSuffix!,
      ].join('-'),
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: [
                'lambda.amazonaws.com',
              ],
            },
            Action: [
              'sts:AssumeRole',
            ],
          },
        ],
      },
      managedPolicyArns: [
        `arn:${this.partition}:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`,
      ],
      policies: [
        {
          policyName: 'SQSReaderPolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'SQS:DeleteMessage',
                  'SQS:GetQueueAttributes',
                  'SQS:ReceiveMessage',
                ],
                Resource: spapiNotificationsQueue.attrArn,
              },
            ],
          },
        },
        {
          policyName: 'StepFunctionsPolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'states:StartExecution',
                ],
                Resource: spapiStateMachine.ref,
              },
            ],
          },
        },
      ],
    });

    const spapiProcessNotificationLambdaFunction = new lambda.CfnFunction(this, 'SPAPIProcessNotificationLambdaFunction', {
      functionName: [
        'SPAPIProcessNotificationLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Process Notifications Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiProcessNotificationLambdaFunctionHandler.valueAsString!,
      role: spapiNotificationsLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'STATE_MACHINE_ARN': spapiStateMachine.ref,
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
        },
      },
    });

    const spapiNotificationsEventSourceMapping = new lambda.CfnEventSourceMapping(this, 'SPAPINotificationsEventSourceMapping', {
      batchSize: 1,
      enabled: true,
      eventSourceArn: spapiNotificationsQueue.attrArn,
      functionName: spapiProcessNotificationLambdaFunction.attrArn,
    });
  }
}
