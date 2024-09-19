import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import {DefaultStackSynthesizer} from "aws-cdk-lib";

export interface SpApiAppCdkStackProps extends cdk.StackProps {
  readonly randomSuffix: string;
  readonly spApiCdkQualifier: string;
}

export interface SpApiAppCdkStackProps extends cdk.StackProps {
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
    const clientId = new cdk.CfnParameter(this, 'clientId', {
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
      noEcho: true,
      description: "Refresh token of the SP-API app"
    });

    const regionCode = new cdk.CfnParameter(this, 'regionCode', {
      type: 'String',
      noEcho: true,
      description: "Region code of the SP-API app"
    });

    const programmingLanguage = new cdk.CfnParameter(this, 'programmingLanguage', {
      type: 'String',
      description: 'Programming language of the Lambda functions'
    });

    const artifactsS3BucketName = new cdk.CfnParameter(this, 'artifactsS3BucketName', {
      type: 'String',
      description: "Name of the S3 bucket containing the application's artifacts"
    });

    const lambdaFunctionsCodeS3Key = new cdk.CfnParameter(this, 'lambdaFunctionsCodeS3Key', {
      type: 'String',
      description: "Key of the S3 file containing the Lambda functions code"
    });

    const stepFunctionsStateMachineDefinitionS3Key = new cdk.CfnParameter(this, 'stepFunctionsStateMachineDefinitionS3Key', {
      type: 'String',
      description: "Key of the S3 file containing the Step Functions state machine definition"
    });

    const cancelOrderLambdaFunctionHandler = new cdk.CfnParameter(this, 'cancelOrderLambdaFunctionHandler', {
      type: 'String',
      description: "Cancel order lambda function handler"
    });

    const createOrderLambdaFunctionHandler = new cdk.CfnParameter(this, 'createOrderLambdaFunctionHandler', {
      type: 'String',
      description: "Create order lambda function handler"
    });

    const getOrderLambdaFunctionHandler = new cdk.CfnParameter(this, 'getOrderLambdaFunctionHandler', {
      type: 'String',
      description: "Get order lambda function handler"
    });

    const getOrderTrackingDetailsLambdaFunctionHandler = new cdk.CfnParameter(this, 'getOrderTrackingDetailsLambdaFunctionHandler', {
      type: 'String',
      description: "Get order tracking details lambda function handler"
    });

    const getPackageTrackingDetailsLambdaFunctionHandler = new cdk.CfnParameter(this, 'getPackageTrackingDetailsLambdaFunctionHandler', {
      type: 'String',
      description: "Get package tracking details lambda function handler"
    });

    const previewOrderLambdaFunctionHandler = new cdk.CfnParameter(this, 'previewOrderLambdaFunctionHandler', {
      type: 'String',
      description: "Preview order lambda function handler"
    });

    const processCancelNotificationLambdaFunctionHandler = new cdk.CfnParameter(this, 'processCancelNotificationLambdaFunctionHandler', {
      type: 'String',
      description: "Process cancel notification lambda function handler"
    });

    const processNotificationLambdaFunctionHandler = new cdk.CfnParameter(this, 'processNotificationLambdaFunctionHandler', {
      type: 'String',
      description: "Process notification lambda function handler"
    });

    const processTrackingDetailsNotificationLambdaFunctionHandler = new cdk.CfnParameter(this, 'processTrackingDetailsNotificationLambdaFunctionHandler', {
      type: 'String',
      description: "Process tracking details notification lambda function handler"
    });

    const subscribeNotificationsLambdaFunctionHandler = new cdk.CfnParameter(this, 'subscribeNotificationsLambdaFunctionHandler', {
      type: 'String',
      description: "Subscribe notifications lambda function handler"
    });

    const updateOrderLambdaFunctionHandler = new cdk.CfnParameter(this, 'updateOrderLambdaFunctionHandler', {
      type: 'String',
      description: "Update order lambda function handler"
    });

    const stepFunctionsStateMachineCancelDefinitionS3Key = new cdk.CfnParameter(this, 'stepFunctionsStateMachineCancelDefinitionS3Key', {
      type: 'String',
      description: "Key of the S3 file containing the Step Functions state machine cancel definition"
    });

    const stepFunctionsStateMachineTrackingDetailsDefinitionS3Key = new cdk.CfnParameter(this, 'stepFunctionsStateMachineTrackingDetailsDefinitionS3Key', {
      type: 'String',
      description: "Key of the S3 file containing the Step Functions state machine tracking details definition"
    });

    // Resources
    const spapiAppCredentials = new secretsmanager.CfnSecret(this, 'SPAPIAppCredentials', {
      name: [
        'SPAPIAppCredentials',
        props.randomSuffix!,
      ].join('-'),
      description: 'Secret containing SP-API app credentials',
      secretString: `{'AppClientId': '${clientId.valueAsString!}', 'AppClientSecret': '${clientSecret.valueAsString!}'}`,
    });

    const spapiCancelNotificationsQueue = new sqs.CfnQueue(this, 'SPAPICancelNotificationsQueue', {
      queueName: [
        'sp-api-cancel-notifications-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 300,
    });

    const labelsS3Bucket = new s3.CfnBucket(this, 'SPAPILabelsS3Bucket', {
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

    const spapiNotificationsQueue = new sqs.CfnQueue(this, 'SPAPINotificationsQueue', {
      queueName: [
        'sp-api-notifications-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 300,
    });

    const spapiTrackingDetailsNotificationsQueue = new sqs.CfnQueue(this, 'SPAPITrackingDetailsNotificationsQueue', {
      queueName: [
        'sp-api-tracking-details-notifications-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 300,
    });

    new sqs.CfnQueuePolicy(this, 'SPAPICancelNotificationsQueuePolicy', {
      queues: [
        spapiCancelNotificationsQueue.ref,
      ],
      policyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'SQS:SendMessage',
              'SQS:GetQueueAttributes',
            ],
            Resource: spapiCancelNotificationsQueue.attrArn,
            Principal: {
              AWS: [
                '437568002678',
              ],
            },
          },
        ],
      },
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
                Resource: labelsS3Bucket.attrArn,
              }
            ]
          }
        }
      ]
    });

    new sqs.CfnQueuePolicy(this, 'SPAPINotificationsQueuePolicy', {
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

    new sqs.CfnQueuePolicy(this, 'SPAPITrackingDetailsNotificationsQueuePolicy', {
      queues: [
        spapiTrackingDetailsNotificationsQueue.ref,
      ],
      policyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'SQS:SendMessage',
              'SQS:GetQueueAttributes',
            ],
            Resource: spapiTrackingDetailsNotificationsQueue.attrArn,
            Principal: {
              AWS: [
                '437568002678',
              ],
            },
          },
        ],
      },
    });

    const spapiCancelOrderLambdaFunction = new lambda.CfnFunction(this, 'SPAPICancelOrderLambdaFunction', {
      functionName: [
        'SPAPICancelOrderLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Retrieve Order Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: cancelOrderLambdaFunctionHandler.valueAsString!,
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

    const spapiCreateOrderLambdaFunction = new lambda.CfnFunction(this, 'SPAPICreateOrderLambdaFunction', {
      functionName: [
        'SPAPICreateOrderLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Retrieve Order Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: createOrderLambdaFunctionHandler.valueAsString!,
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

    const spapiGetOrderLambdaFunction = new lambda.CfnFunction(this, 'SPAPIGetOrderLambdaFunction', {
      functionName: [
        'SPAPIGetOrderLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Retrieve Order Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: getOrderLambdaFunctionHandler.valueAsString!,
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

    const spapiGetOrderTrackingDetailsLambdaFunction = new lambda.CfnFunction(this, 'SPAPIGetOrderTrackingDetailsLambdaFunction', {
      functionName: [
        'SPAPIGetOrderTrackingDetailsLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Retrieve Order Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: getOrderTrackingDetailsLambdaFunctionHandler.valueAsString!,
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

    const spapiGetPackageTrackingDetailsLambdaFunction = new lambda.CfnFunction(this, 'SPAPIGetPackageTrackingDetailsLambdaFunction', {
      functionName: [
        'SPAPIGetPackageTrackingDetailsLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Retrieve Order Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: getPackageTrackingDetailsLambdaFunctionHandler.valueAsString!,
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

    const spapiPreviewOrderLambdaFunction = new lambda.CfnFunction(this, 'SPAPIPreviewOrderLambdaFunction', {
      functionName: [
        'SPAPIPreviewOrderLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Retrieve Order Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: previewOrderLambdaFunctionHandler.valueAsString!,
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

    new lambda.CfnFunction(this, 'SPAPISubscribeNotificationsLambdaFunction', {
      functionName: [
        'SPAPISubscribeNotificationsLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Subscribe Notifications Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: subscribeNotificationsLambdaFunctionHandler.valueAsString!,
      role: spapiLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'SQS_QUEUE_ARN': spapiTrackingDetailsNotificationsQueue.attrArn,
        },
      },
    });

    const spapiUpdateOrderLambdaFunction = new lambda.CfnFunction(this, 'SPAPIUpdateOrderLambdaFunction', {
      functionName: [
        'SPAPIUpdateOrderLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Retrieve Order Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: updateOrderLambdaFunctionHandler.valueAsString!,
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

    const spapiStateMachineCancelExecutionRole = new iam.CfnRole(this, 'SPAPIStateMachineCancelExecutionRole', {
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
                  spapiCancelOrderLambdaFunction.attrArn,
                ],
              },
            ],
          },
        },
      ],
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
                  spapiCreateOrderLambdaFunction.attrArn,
                  spapiGetOrderLambdaFunction.attrArn,
                  spapiPreviewOrderLambdaFunction.attrArn,
                  spapiUpdateOrderLambdaFunction.attrArn,
                ],
              },
            ],
          },
        },
      ],
    });

    const spapiStateMachineTrackingDetailsExecutionRole = new iam.CfnRole(this, 'SPAPIStateMachineTrackingDetailsExecutionRole', {
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
                  spapiGetPackageTrackingDetailsLambdaFunction.attrArn,
                  spapiGetOrderTrackingDetailsLambdaFunction.attrArn,
                ],
              },
            ],
          },
        },
      ],
    });

    const spapiCancelStateMachine = new stepfunctions.CfnStateMachine(this, 'SPAPICancelStateMachine', {
      stateMachineName: [
        'SPAPICancelStateMachine',
        props.randomSuffix!,
      ].join('-'),
      stateMachineType: 'STANDARD',
      definitionS3Location: {
        bucket: artifactsS3BucketName.valueAsString!,
        key: stepFunctionsStateMachineCancelDefinitionS3Key.valueAsString!,
      },
      definitionSubstitutions: {
        CancelOrderLambdaFunctionArn: spapiCancelOrderLambdaFunction.attrArn,
      },
      roleArn: spapiStateMachineCancelExecutionRole.attrArn,
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
        CancelOrderLambdaFunctionArn: spapiCancelOrderLambdaFunction.attrArn,
        CreateOrderLambdaFunctionArn: spapiCreateOrderLambdaFunction.attrArn,
        GetOrderLambdaFunctionArn: spapiGetOrderLambdaFunction.attrArn,
        GetPackageTrackingDetailsLambdaFunctionArn: spapiGetPackageTrackingDetailsLambdaFunction.attrArn,
        PreviewOrderLambdaFunctionArn: spapiPreviewOrderLambdaFunction.attrArn,
        UpdateOrderLambdaFunctionArn: spapiUpdateOrderLambdaFunction.attrArn,
      },
      roleArn: spapiStateMachineExecutionRole.attrArn,
    });

    const spapiTrackingDetailsStateMachine = new stepfunctions.CfnStateMachine(this, 'SPAPITrackingDetailsStateMachine', {
      stateMachineName: [
        'SPAPITrackingDetailsStateMachine',
        props.randomSuffix!,
      ].join('-'),
      stateMachineType: 'STANDARD',
      definitionS3Location: {
        bucket: artifactsS3BucketName.valueAsString!,
        key: stepFunctionsStateMachineTrackingDetailsDefinitionS3Key.valueAsString!,
      },
      definitionSubstitutions: {
        GetPackageTrackingDetailsLambdaFunctionArn: spapiGetPackageTrackingDetailsLambdaFunction.attrArn,
        GetOrderTrackingDetailsLambdaFunctionArn: spapiGetOrderTrackingDetailsLambdaFunction.attrArn,
      },
      roleArn: spapiStateMachineTrackingDetailsExecutionRole.attrArn,
    });

    const spapiCancelNotificationsLambdaExecutionRole = new iam.CfnRole(this, 'SPAPICancelNotificationsLambdaExecutionRole', {
      roleName: [
        'SPAPICancelNotificationsLambdaExecutionRole',
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
                Resource: spapiCancelNotificationsQueue.attrArn,
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
                Resource: spapiCancelStateMachine.ref,
              },
            ],
          },
        },
      ],
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

    const spapiTrackingDetailsNotificationsLambdaExecutionRole = new iam.CfnRole(this, 'SPAPITrackingDetailsNotificationsLambdaExecutionRole', {
      roleName: [
        'SPAPITrackingDetailsNotificationsLambdaExecutionRole',
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
                Resource: spapiTrackingDetailsNotificationsQueue.attrArn,
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
                Resource: spapiTrackingDetailsStateMachine.ref,
              },
            ],
          },
        },
      ],
    });

    const spapiProcessCancelNotificationLambdaFunction = new lambda.CfnFunction(this, 'SPAPIProcessCancelNotificationLambdaFunction', {
      functionName: [
        'SPAPIProcessCancelNotificationLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Process Notifications Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: processCancelNotificationLambdaFunctionHandler.valueAsString!,
      role: spapiCancelNotificationsLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'STATE_MACHINE_ARN': spapiCancelStateMachine.ref,
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
        },
      },
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
      handler: processNotificationLambdaFunctionHandler.valueAsString!,
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

    const spapiProcessTrackingDetailsNotificationLambdaFunction = new lambda.CfnFunction(this, 'SPAPIProcessTrackingDetailsNotificationLambdaFunction', {
      functionName: [
        'SPAPIProcessTrackingDetailsNotificationLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Process Notifications Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: processTrackingDetailsNotificationLambdaFunctionHandler.valueAsString!,
      role: spapiTrackingDetailsNotificationsLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'STATE_MACHINE_ARN': spapiTrackingDetailsStateMachine.ref,
          'REFRESH_TOKEN': refreshToken.valueAsString!,
          'REGION_CODE': regionCode.valueAsString!,
        },
      },
    });

    new lambda.CfnEventSourceMapping(this, 'SPAPICancelNotificationsEventSourceMapping', {
      batchSize: 1,
      enabled: true,
      eventSourceArn: spapiCancelNotificationsQueue.attrArn,
      functionName: spapiProcessCancelNotificationLambdaFunction.attrArn,
    });

    new lambda.CfnEventSourceMapping(this, 'SPAPINotificationsEventSourceMapping', {
      batchSize: 1,
      enabled: true,
      eventSourceArn: spapiNotificationsQueue.attrArn,
      functionName: spapiProcessNotificationLambdaFunction.attrArn,
    });

    new lambda.CfnEventSourceMapping(this, 'SPAPITrackingDetailsNotificationsEventSourceMapping', {
      batchSize: 1,
      enabled: true,
      eventSourceArn: spapiTrackingDetailsNotificationsQueue.attrArn,
      functionName: spapiProcessTrackingDetailsNotificationLambdaFunction.attrArn,
    });
  }
}
