import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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

    const regionCode = new cdk.CfnParameter(this, 'regionCode', {
      type: 'String',
      description: 'Region Code used for testing the SP-API app'
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

    const lwaRotateClientSecretRequestLambdaFunctionHandler = new cdk.CfnParameter(this, 'lwaRotateClientSecretRequestLambdaFunctionHandler', {
      type: 'String',
      description: "Lambda Handler of LWA Rotate Client Secret Request Lambda Function"
    });

    const lwaUpdateNewClientSecretLambdaFunctionHandler = new cdk.CfnParameter(this, 'lwaUpdateNewClientSecretLambdaFunctionHandler', {
      type: 'String',
      description: "Handler of LWA Update New Client Secrets Lambda Function"
    });


    // Resources
    const kmsKey = new kms.CfnKey(this, 'KMSKey', {
      description: 'KMS Key for LWA SQS Queue Encryption',
      enableKeyRotation: true,
      keyPolicy: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'Allow administration of the key',
            Effect: 'Allow',
            Principal: {
              AWS: `arn:${this.partition}:iam::${this.account}:root`,
            },
            Action: 'kms:*',
            Resource: '*',
          },
        ],
      },
    });

    const lwaNewSecretDeadLetterQueue = new sqs.CfnQueue(this, 'LWANewSecretDeadLetterQueue', {
      queueName: [
        'lwa-new-secret-dead-letter-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 60,
    });

    const lwaSecretExpiryDeadLetterQueue = new sqs.CfnQueue(this, 'LWASecretExpiryDeadLetterQueue', {
      queueName: [
        'lwa-secret-expiry-dead-letter-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 60,
    });

    const spapiAppCredentials = new secretsmanager.CfnSecret(this, 'SPAPIAppCredentials', {
      name: [
        'SPAPIAppCredentials',
        props.randomSuffix!,
      ].join('-'),
      description: 'Secret containing SP-API app credentials',
      secretString: `{"AppClientId": "${clientId.valueAsString!}", "AppClientSecret": "${clientSecret.valueAsString!}"}`,
    });

    const lwaNewSecretQueue = new sqs.CfnQueue(this, 'LWANewSecretQueue', {
      queueName: [
        'lwa-new-secret-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 60,
      redrivePolicy: {
        deadLetterTargetArn: lwaNewSecretDeadLetterQueue.attrArn,
        maxReceiveCount: 3,
      },
    });

    const lwaSecretExpiryQueue = new sqs.CfnQueue(this, 'LWASecretExpiryQueue', {
      queueName: [
        'lwa-secret-expiry-queue',
        props.randomSuffix!,
      ].join('-'),
      visibilityTimeout: 60,
      redrivePolicy: {
        deadLetterTargetArn: lwaNewSecretDeadLetterQueue.attrArn,
        maxReceiveCount: 3,
      },
      kmsMasterKeyId: kmsKey.ref,
    });

    const lwaNewSecretQueuePolicy = new sqs.CfnQueuePolicy(this, 'LWANewSecretQueuePolicy', {
      queues: [
        lwaNewSecretQueue.ref,
      ],
      policyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'SQS:SendMessage',
              'SQS:GetQueueAttributes',
              'SQS:ReceiveMessage',
            ],
            Resource: lwaNewSecretQueue.attrArn,
            Principal: {
              AWS: [
                '437568002678',
              ],
            },
          },
        ],
      },
    });

    const lwaRotateClientSecretRequestLambdaExecutionRole = new iam.CfnRole(this, 'LWARotateClientSecretRequestLambdaExecutionRole', {
      roleName: [
        'LWARotateClientSecretRequestLambdaExecutionRole',
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
                Action: [
                  'secretsmanager:GetSecretValue',
                ],
                Resource: [
                  spapiAppCredentials.ref,
                ],
              },
            ],
          },
        },
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
                Resource: lwaSecretExpiryQueue.attrArn,
              },
            ],
          },
        },
        {
          policyName: 'KMSDecryptPolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'kms:Decrypt',
                ],
                Resource: kmsKey.attrArn,
              },
            ],
          },
        },
      ],
    });

    const lwaSecretExpiryQueuePolicy = new sqs.CfnQueuePolicy(this, 'LWASecretExpiryQueuePolicy', {
      queues: [
        lwaSecretExpiryQueue.ref,
      ],
      policyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'sqs:SendMessage',
              'sqs:GetQueueAttributes',
              'sqs:ReceiveMessage',
            ],
            Resource: lwaSecretExpiryQueue.attrArn,
            Principal: {
              AWS: [
                '437568002678',
              ],
            },
          },
        ],
      },
    });

    const lwaUpdateNewClientSecretLambdaExecutionRole = new iam.CfnRole(this, 'LWAUpdateNewClientSecretLambdaExecutionRole', {
      roleName: [
        'LWAUpdateNewClientSecretLambdaExecutionRole',
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
                Action: [
                  'secretsmanager:GetSecretValue',
                  'secretsmanager:PutSecretValue',
                ],
                Resource: [
                  spapiAppCredentials.ref,
                ],
              },
            ],
          },
        },
        {
          policyName: 'SQSReceiveMessagePolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'SQS:ReceiveMessage',
                  'SQS:DeleteMessage',
                  'SQS:GetQueueAttributes',
                ],
                Resource: lwaNewSecretQueue.attrArn,
              },
            ],
          },
        },
        {
          policyName: 'KMSDecryptPolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'kms:Decrypt',
                ],
                Resource: kmsKey.attrArn,
              },
            ],
          },
        },
      ],
    });

    const lwaRotateClientSecretRequestLambdaFunction = new lambda.CfnFunction(this, 'LWARotateClientSecretRequestLambdaFunction', {
      functionName: [
        'LWARotateClientSecretRequestLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Lambda function to rotate LWA client secret requests',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: lwaRotateClientSecretRequestLambdaFunctionHandler.valueAsString!,
      role: lwaRotateClientSecretRequestLambdaExecutionRole.attrArn,
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

    const lwaUpdateNewClientSecretLambdaFunction = new lambda.CfnFunction(this, 'LWAUpdateNewClientSecretLambdaFunction', {
      functionName: [
        'LWAUpdateNewClientSecretLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Lambda function to update new client secrets',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: lwaUpdateNewClientSecretLambdaFunctionHandler.valueAsString!,
      role: lwaUpdateNewClientSecretLambdaExecutionRole.attrArn,
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

    const lwaRotateClientSecretRequestLambdaEventSourceMapping = new lambda.CfnEventSourceMapping(this, 'LWARotateClientSecretRequestLambdaEventSourceMapping', {
      batchSize: 1,
      enabled: true,
      eventSourceArn: lwaSecretExpiryQueue.attrArn,
      functionName: lwaRotateClientSecretRequestLambdaFunction.attrArn,
    });

    const lwaUpdateNewClientSecretLambdaEventSourceMapping = new lambda.CfnEventSourceMapping(this, 'LWAUpdateNewClientSecretLambdaEventSourceMapping', {
      batchSize: 1,
      enabled: true,
      eventSourceArn: lwaNewSecretQueue.attrArn,
      functionName: lwaUpdateNewClientSecretLambdaFunction.attrArn,
    });
  }
}
