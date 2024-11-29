import * as cdk from 'aws-cdk-lib';
import {DefaultStackSynthesizer} from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
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

    // Parameters
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

    const refreshToken = new cdk.CfnParameter(this, 'refreshToken', {
        type: 'String',
        description: 'Refresh Token used for testing the SP-API app'
    });

    const regionCode = new cdk.CfnParameter(this, 'regionCode', {
        type: 'String',
        description: 'Region Code used for testing the SP-API app [NA/EU/FE]'
    });

    const programmingLanguage = new cdk.CfnParameter(this, 'programmingLanguage', {
        type: 'String',
        description: 'Programming language of the Lambda functions'
    });

    const artifactsS3BucketName = new cdk.CfnParameter(this, 'artifactS3BucketName', {
        type: 'String',
        description: "Name of the S3 bucket containing the application's artifacts"
    });

    const lambdaFunctionsCodeS3Key = new cdk.CfnParameter(this, 'lambdaFunctionCodeS3Key', {
        type: 'String',
        description: "Key of the S3 file containing the Lambda functions code"
    });

    const spapiRetrieveOrderLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiRetrieveOrderLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Retrieve Order Lambda Function"
    });

    const oneClickShipment = new cdk.CfnParameter(this, 'oneClickShipment', {
        type: 'String',
        description: "Smart Purchase - only valid between y and n"
    });

    const spapiGetRatesLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiGetRatesLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Get Rates Lambda Function"
    });

    const spapiGetAdditionalInputsLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiGetAdditionalInputsLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Get Additional Inputs Lambda Function"
    });

    const spapiInventoryCheckLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiInventoryCheckLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Inventory Check Lambda Function"
    });

    const spapiEligibleShipmentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiEligibleShipmentLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Eligible Shipment Lambda Function"
    });

    const spapiSelectShipmentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiSelectShipmentLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Select Shipment Lambda Function"
    });

    const spapiCreateShipmentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiCreateShipmentLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Create Shipment Lambda Function"
    });

    const spapiPresignS3LabelLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiPresignS3LabelLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Presign S3 Label Lambda Function"
    });

    const spapiProcessNotificationLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiProcessNotificationLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Process Notification Lambda Function"
    });

    const spapiOneClickShipmentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiOneClickShipmentLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of One Click Shipment Lambda Function"
    });

    const spapiPurchaseShipmentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiPurchaseShipmentLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Purchase Shipment Lambda Function"
    });

    const spapiSubscribeNotificationsLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiSubscribeNotificationsLambdaFunctionHandler', {
        type: 'String',
        description: "Handler of Subscribe Notifications Lambda Function"
    });

    const stepFunctionsStateMachineDefinitionS3Key = new cdk.CfnParameter(this, 'stepFunctionStateMachineDefinitionS3Key', {
        type: 'String',
        description: "Key of the S3 file containing the Step Functions state machine definition"
    });

    const notificationEmail = new cdk.CfnParameter(this, 'notificationEmail', {
        type: 'String',
        description: "Email for Label Notifications"
    });

    const spapiCancelShipmentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiCancelShipmentLambdaFunctionHandler', {
        type: 'String',
        description: "Handler to Cancel Shipment"
    });

    const spapiGetTrackingLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiGetTrackingLambdaFunctionHandler', {
        type: 'String',
        description: "Handler to get tracking for shipment"
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

    const spapiInventoryTable = new dynamodb.CfnTable(this, 'SPAPIInventoryTable', {
      tableName: [
        'SPAPIInventoryTable',
        props.randomSuffix!,
      ].join('-'),
      attributeDefinitions: [
        {
          attributeName: 'SKU',
          attributeType: 'S',
        },
      ],
      keySchema: [
        {
          attributeName: 'SKU',
          keyType: 'HASH',
        },
      ],
      billingMode: 'PAY_PER_REQUEST',
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    const spApiLabelsS3Bucket = new s3.CfnBucket(this, 'SPAPILabelsS3Bucket', {
      bucketName: [
        'sp-api-labels-s3-bucket',
        props.randomSuffix!,
      ].join('-'),
      bucketEncryption: {
        serverSideEncryptionConfiguration: [
          {
            serverSideEncryptionByDefault: {
              sseAlgorithm: 'AES256',
            },
          },
        ],
      },
    });

    const spapiBucketAccessRole = new iam.CfnRole(this, 'SPAPIBucketAccessRole', {
      roleName: [
        'SPAPIBucketAccessRole',
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
          policyName: 'S3Policy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  's3:GetObject',
                  's3:PutObject',
                ],
                Resource: spApiLabelsS3Bucket.attrArn,
              },
            ],
          },
        },
      ],
    });

    const spapiNotificationSnsTopic = new sns.CfnTopic(this, 'SPAPINotificationSNSTopic', {
      topicName: [
        'SPAPINotificationSNSTopic',
        props.randomSuffix!,
      ].join('-'),
    });

    const spapiNotificationsQueue = new sqs.CfnQueue(this, 'SPAPINotificationsQueue', {
      queueName: [
        'sp-api-notifications-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 300,
    });

    const spapiShipmentsTable = new dynamodb.CfnTable(this, 'SPAPIShipmentsTable', {
      tableName: [
        'SPAPIShipmentsTable',
        props.randomSuffix!,
      ].join('-'),
      attributeDefinitions: [
        {
          attributeName: 'OrderId',
          attributeType: 'S',
        },
      ],
      keySchema: [
        {
          attributeName: 'OrderId',
          keyType: 'HASH',
        },
      ],
      billingMode: 'PAY_PER_REQUEST',
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    const spapiInventoryDatabaseAccessRole = new iam.CfnRole(this, 'SPAPIInventoryDatabaseAccessRole', {
      roleName: [
        'SPAPIInventoryDatabaseAccessRole',
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
                Action: 'dynamodb:GetItem',
                Resource: spapiInventoryTable.attrArn,
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

    const spapiNotificationSubscription = new sns.CfnSubscription(this, 'SPAPINotificationSubscription', {
      topicArn: spapiNotificationSnsTopic.ref,
      protocol: 'email',
      endpoint: notificationEmail.valueAsString!,
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

    const spapiPresignS3LabelLambdaFunction = new lambda.CfnFunction(this, 'SPAPIPresignS3LabelLambdaFunction', {
      functionName: [
        'SPAPIPresignS3LabelLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Presign S3 Label Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiPresignS3LabelLambdaFunctionHandler.valueAsString!,
      role: spapiBucketAccessRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'LABELS_S3_BUCKET_NAME': spApiLabelsS3Bucket.ref,
        },
      },
    });

    const spapiPurchaseShipmentExecutionRole = new iam.CfnRole(this, 'SPAPIPurchaseShipmentExecutionRole', {
      roleName: [
        'SPAPIPurchaseShipmentExecutionRole',
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
        {
          policyName: 'DynamoDBWriterPolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: 'dynamodb:PutItem',
                Resource: spapiShipmentsTable.attrArn,
              },
            ],
          },
        },
      ],
    });

    const spapiCancelShipmentLambdaFunction = new lambda.CfnFunction(this, 'SPAPICancelShipmentLambdaFunction', {
      functionName: [
        'SPAPICancelShipmentLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Subscribe Notifications Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiCancelShipmentLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
        },
      },
    });

    const spapiGetAdditionalInputsLambdaFunction = new lambda.CfnFunction(this, 'SPAPIGetAdditionalInputsLambdaFunction', {
      functionName: [
        'SPAPIGetAdditionalInputsLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Get Additional Inputs Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiGetAdditionalInputsLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
        },
      },
    });

    const spapiGetRatesLambdaFunction = new lambda.CfnFunction(this, 'SPAPIGetRatesLambdaFunction', {
      functionName: [
        'SPAPIGetRatesLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Get Rates Shipment Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiGetRatesLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
        },
      },
    });

    const spapiGetTrackingLambdaFunction = new lambda.CfnFunction(this, 'SPAPIGetTrackingLambdaFunction', {
      functionName: [
        'SPAPIGetTrackingLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Get Shipment Tracking Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiGetTrackingLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
        },
      },
    });

    const spapiInventoryCheckLambdaFunction = new lambda.CfnFunction(this, 'SPAPIInventoryCheckLambdaFunction', {
      functionName: [
        'SPAPIInventoryCheckLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Inventory Check Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiInventoryCheckLambdaFunctionHandler.valueAsString!,
      role: spapiInventoryDatabaseAccessRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'INVENTORY_TABLE_NAME': spapiInventoryTable.ref,
        },
      },
    });

    const spapiOneClickShipmentLambdaFunction = new lambda.CfnFunction(this, 'SPAPIOneClickShipmentLambdaFunction', {
      functionName: [
        'SPAPIOneClickShipmentLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'One Click Shipment Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiOneClickShipmentLambdaFunctionHandler.valueAsString!,
      role: spapiPurchaseShipmentExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'SHIPMENTS_TABLE_NAME': spapiShipmentsTable.ref,
        },
      },
    });

    const spapiPurchaseShipmentLambdaFunction = new lambda.CfnFunction(this, 'SPAPIPurchaseShipmentLambdaFunction', {
      functionName: [
        'SPAPIPurchaseShipmentLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Purchase Shipment Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiPurchaseShipmentLambdaFunctionHandler.valueAsString!,
      role: spapiPurchaseShipmentExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'SHIPMENTS_TABLE_NAME': spapiShipmentsTable.ref,
        },
      },
    });

    const spapiRetrieveOrderLambdaFunction = new lambda.CfnFunction(this, 'SPAPIRetrieveOrderLambdaFunction', {
      functionName: [
        'SPAPIRetrieveOrderLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Retrieve Order Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiRetrieveOrderLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'SHIP_FROM_EMAIL': notificationEmail.valueAsString!,
        },
      },
    });

    const spapiSelectShipmentLambdaFunction = new lambda.CfnFunction(this, 'SPAPISelectShipmentLambdaFunction', {
      functionName: [
        'SPAPISelectShipmentLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Select Shipment Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiSelectShipmentLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SHIPMENT_FILTER_TYPE': 'CHEAPEST',
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
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
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
                  spapiRetrieveOrderLambdaFunction.attrArn,
                  spapiInventoryCheckLambdaFunction.attrArn,
                  spapiGetRatesLambdaFunction.attrArn,
                  spapiGetAdditionalInputsLambdaFunction.attrArn,
                  spapiOneClickShipmentLambdaFunction.attrArn,
                  spapiSelectShipmentLambdaFunction.attrArn,
                  spapiPurchaseShipmentLambdaFunction.attrArn,
                  spapiPresignS3LabelLambdaFunction.attrArn,
                ],
              },
            ],
          },
        },
        {
          policyName: 'SnsPolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: 'sns:Publish',
                Resource: spapiNotificationSnsTopic.ref,
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
        RetrieveOrderLambdaFunctionArn: spapiRetrieveOrderLambdaFunction.attrArn,
        InventoryCheckLambdaFunctionArn: spapiInventoryCheckLambdaFunction.attrArn,
        GetRatesLambdaFunctionArn: spapiGetRatesLambdaFunction.attrArn,
        GetAdditionalInputsLambdaFunctionArn: spapiGetAdditionalInputsLambdaFunction.attrArn,
        OneClickShipmentLambdaFunctionArn: spapiOneClickShipmentLambdaFunction.attrArn,
        SelectShipmentLambdaFunctionArn: spapiSelectShipmentLambdaFunction.attrArn,
        PurchaseShipmentLambdaFunctionArn: spapiPurchaseShipmentLambdaFunction.attrArn,
        PresignS3LabelLambdaFunctionArn: spapiPresignS3LabelLambdaFunction.attrArn,
        NotificationTopicArn: spapiNotificationSnsTopic.ref,
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
