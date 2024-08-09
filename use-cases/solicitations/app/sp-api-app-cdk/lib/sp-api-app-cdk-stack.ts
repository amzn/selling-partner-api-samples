import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import {DefaultStackSynthesizer} from "aws-cdk-lib";

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
    const clientId = new cdk.CfnParameter(this, 'clientId', {
      type: 'String',
      noEcho: true,
      description: "Client id of the SP-API app"
    });

    const clientSecret = new cdk.CfnParameter(this, 'clientSecret', {
      type: 'String',
      noEcho: true,
      description: "Client Secret of the SP-API app"
    });

    const refreshToken = new cdk.CfnParameter(this, 'refreshToken', {
      type: 'String',
      noEcho: true,
      description: "Refresh Token used for testing the SP-API app"
    });

    const programmingLanguage = new cdk.CfnParameter(this, 'programmingLanguage', {
      type: 'String',
      description: "Programming language of the Lambda functions"
    });

    const artifactsS3BucketName = new cdk.CfnParameter(this, 'artifactsS3BucketName', {
      type: 'String',
      description: "Name of the S3 bucket containing the application's artifacts"
    });

    const lambdaFunctionsCodeS3Key = new cdk.CfnParameter(this, 'lambdaFunctionsCodeS3Key', {
      type: 'String',
      description: "Key of the S3 file containing the Lambda functions code"
    });

    const spapiSolicitationSchedulerHandler = new cdk.CfnParameter(this, 'spapiSolicitationSchedulerHandler', {
      type: 'String',
      description: "Handler of SP-API Solicitation Scheduler Lambda Function"
    });

    const spapiGetSolicitationActionsHandler = new cdk.CfnParameter(this, 'spapiGetSolicitationActionsHandler', {
      type: 'String',
      description: "Handler of SP-API Get Solicitation Actions Lambda Function"
    });

    const spapiSubmitSolicitationHandler = new cdk.CfnParameter(this, 'spapiSubmitSolicitationHandler', {
      type: 'String',
      description: "Handler of SP-API Submit Solicitation Lambda Function"
    });

    const spapiSubscribeNotificationsHandler = new cdk.CfnParameter(this, 'spapiSubscribeNotificationsHandler', {
      type: 'String',
      description: "Handler of SP-API Subscribe Notifications Lambda Function"
    });

    const stepFunctionsStateMachineDefinitionS3Key = new cdk.CfnParameter(this, 'stepFunctionsStateMachineDefinitionS3Key', {
      type: 'String',
      description: "Key of the S3 file containing the Step Functions state machine definition"
    });

    // Resources
    const spapiAppCredentials = new secretsmanager.CfnSecret(this, 'SPAPIAppCredentials', {
      name: [
        'SPAPIAppCredentials',
        props.randomSuffix!,
      ].join('-'),
      description: 'Secret containing SP-API app credentials',
      secretString: `{"AppClientId": "${clientId.valueAsString!}", "AppClientSecret": "${clientSecret.valueAsString!}"}`
    });

    const spapiNotificationsDeadLetterQueue = new sqs.CfnQueue(this, 'SPAPINotificationsDeadLetterQueue', {
      queueName: [
        'sp-api-notifications-dead-letter-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 60,
    });

    const spapiDefaultExecutionRole = new iam.CfnRole(this, 'SPAPIDefaultExecutionRole', {
      roleName: [
        'SPAPIDefaultExecutionRole',
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

    const spapiGetSolicitationActionsLambdaExecutionRole = new iam.CfnRole(this, 'SPAPIGetSolicitationActionsLambdaExecutionRole', {
      roleName: [
        'SPAPIGetSolicitationActionsLambdaExecutionRole',
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
          policyName: 'EventBridgePolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'scheduler:DeleteSchedule',
                ],
                Resource: '*',
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
        maxReceiveCount: 5,
      },
    });

    const spapiGetSolicitationActionsLambdaFunction = new lambda.CfnFunction(this, 'SPAPIGetSolicitationActionsLambdaFunction', {
      functionName: [
        'SPAPIGetSolicitationActions',
        props.randomSuffix!,
      ].join('-'),
      description: 'SP-API Get Solicitation Actions Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiGetSolicitationActionsHandler.valueAsString!,
      role: spapiGetSolicitationActionsLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'REFRESH_TOKEN': refreshToken.valueAsString!,
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

    const spapiSolicitationSchedulerLambdaExecutionRole = new iam.CfnRole(this, 'SPAPISolicitationSchedulerLambdaExecutionRole', {
      roleName: [
        'SPAPISolicitationSchedulerLambdaExecutionRole',
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
          policyName: 'SQSPolicy',
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
          policyName: 'EventBridgePolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'scheduler:GetSchedule',
                  'scheduler:CreateSchedule',
                  'iam:PassRole',
                ],
                Resource: '*',
              },
            ],
          },
        },
      ],
    });

    const spapiSubmitSolicitationLambdaFunction = new lambda.CfnFunction(this, 'SPAPISubmitSolicitationLambdaFunction', {
      functionName: [
        'SPAPISubmitSolicitation',
        props.randomSuffix!,
      ].join('-'),
      description: 'SP-API Submit Solicitation Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiSubmitSolicitationHandler.valueAsString!,
      role: spapiDefaultExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
          'REFRESH_TOKEN': refreshToken.valueAsString!,
        },
      },
    });

    const spapiSubscribeNotificationsLambdaFunction = new lambda.CfnFunction(this, 'SPAPISubscribeNotificationsLambdaFunction', {
      functionName: [
        'SPAPISubscribeNotifications',
        props.randomSuffix!,
      ].join('-'),
      description: 'SP-API Subscribe Notifications Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiSubscribeNotificationsHandler.valueAsString!,
      role: spapiDefaultExecutionRole.attrArn,
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
                  spapiGetSolicitationActionsLambdaFunction.attrArn,
                  spapiSubmitSolicitationLambdaFunction.attrArn,
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
        GetSolicitationActionsLambdaFunctionArn: spapiGetSolicitationActionsLambdaFunction.attrArn,
        SubmitSolicitationLambdaFunctionArn: spapiSubmitSolicitationLambdaFunction.attrArn,
      },
      roleArn: spapiStateMachineExecutionRole.attrArn,
    });

    const spapiSolicitationsSchedulerRole = new iam.CfnRole(this, 'SPAPISolicitationsSchedulerRole', {
      roleName: [
        'SPAPISolicitationsSchedulerRole',
        props.randomSuffix!,
      ].join('-'),
      assumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: [
                'scheduler.amazonaws.com',
              ],
            },
            Condition: {
              StringEquals: {
                'aws:SourceAccount': this.account,
              },
            },
            Action: [
              'sts:AssumeRole',
            ],
          },
        ],
      },
      policies: [
        {
          policyName: 'StepFunctionsPolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: 'states:StartExecution',
                Resource: spapiStateMachine.ref,
              },
            ],
          },
        },
      ],
    });

    const spapiSolicitationSchedulerLambdaFunction = new lambda.CfnFunction(this, 'SPAPISolicitationSchedulerLambdaFunction', {
      functionName: [
        'SPAPISolicitationScheduler',
        props.randomSuffix!,
      ].join('-'),
      description: 'SP-API Solicitation Scheduler Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: spapiSolicitationSchedulerHandler.valueAsString!,
      role: spapiSolicitationSchedulerLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SOLICITATIONS_SCHEDULER_ROLE_ARN': spapiSolicitationsSchedulerRole.attrArn,
          'SOLICITATIONS_STATE_MACHINE_ARN': spapiStateMachine.ref,
        },
      },
    });

    const solicitationSchedulerEventSourceMapping = new lambda.CfnEventSourceMapping(this, 'SolicitationSchedulerEventSourceMapping', {
      batchSize: 1,
      enabled: true,
      eventSourceArn: spapiNotificationsQueue.attrArn,
      functionName: spapiSolicitationSchedulerLambdaFunction.attrArn,
    });
  }
}
