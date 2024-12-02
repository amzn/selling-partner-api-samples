import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
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

        //Parameters

        const accessKey = new cdk.CfnParameter(this, 'accessKey', {
            type: 'String',
            noEcho: true,
            description: "Access Key of the IAM User that will assume the IAM Role registered in the SP-API app"
        });

        const secretKey = new cdk.CfnParameter(this, 'secretKey', {
            type: 'String',
            noEcho: true,
            description: "Secret Key of the IAM User that will assume the IAM Role registered in the SP-API app"
        });

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

        const roleArn = new cdk.CfnParameter(this, 'roleARN', {
            type: 'String',
            description: 'Arn of the IAM Role registered in the SP-API app'
        });

        const programmingLanguage = new cdk.CfnParameter(this, 'programmingLanguage', {
            type: 'String',
            noEcho: true,
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
        const artifactsS3BucketName = new cdk.CfnParameter(this, 'artifactsS3BucketName', {
            type: 'String',
            noEcho: true,
            description: "Name of the S3 bucket containing the application's artifacts"
        });

        const easyshipCreateScheduledPackageLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipCreateScheduledPackageLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function responsible for creating a scheduled package for EasyShip."
        });

        const easyShipGetFeedDocumentLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipGetFeedDocumentLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function that retrieves feed documents for EasyShip."
        });

        const easyShipGetReportDocumentLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipGetReportDocumentLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function that retrieves report documents such as label for EasyShip."
        });

        const easyShipGetScheduledPackageLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipGetScheduledPackageLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function responsible for retrieving scheduled packages for EasyShip."
        });

        const easyShipInventoryCheckLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipInventoryCheckLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function that performs inventory checks for EasyShip."
        });

        const easyShipListHandoverSlotsLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipListHandoverSlotsLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function that lists available handover slots in EasyShip."
        });

        const easyShipProcessNotificationLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipProcessNotificationLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function responsible for processing notifications in EasyShip."
        });

        const easyShipRetrieveOrderLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipRetrieveOrderLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function that retrieves orders from EasyShip."
        });

        const easyShipSubmitFeedRequestLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipSubmitFeedRequestLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function that submits feed requests to EasyShip."
        });

        const easyShipSubscribeNotificationsLambdaFunctionHandler = new cdk.CfnParameter(this, 'easyShipSubscribeNotificationsLambdaFunctionHandler', {
            type: 'String',
            description: "Handler for the Lambda function that subscribes to notifications for EasyShip."
        });

        const lambdaFunctionsCodeS3Key = new cdk.CfnParameter(this, 'lambdaFunctionsCodeS3Key', {
            type: 'String',
            description: "Key of the S3 file containing the Lambda functions code"
        });

        const stepFunctionsStateMachineDefinitionS3Key = new cdk.CfnParameter(this, 'stepFunctionStateMachineDefinitionS3Key', {
            type: 'String',
            description: "Key of the S3 file containing the Step Functions state machine definition"
        });

        const notificationEmail = new cdk.CfnParameter(this, 'notificationEmail', {
            type: 'String',
            description: "Email for Label Notifications"
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

        const spapiEasyShipDocumentsS3Bucket = new s3.CfnBucket(this, 'SPAPIEasyShipDocumentsS3Bucket', {
            publicAccessBlockConfiguration: {
                blockPublicAcls: true,
                ignorePublicAcls: true,
                blockPublicPolicy: true,
                restrictPublicBuckets: true,
            },
            bucketName: [
                'sp-api-easy-ship-documents-s3-bucket',
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

        const spApiNotificationSnsTopic = new sns.CfnTopic(this, 'SPAPINotificationSNSTopic', {
            topicName: [
                'SPAPINotificationSNSTopic',
                props.randomSuffix!,
            ].join('-'),
        });

        const spApiNotificationSubscription = new sns.CfnSubscription(this, 'SPAPINotificationSubscription', {
            topicArn: spApiNotificationSnsTopic.ref,
            protocol: 'email',
            endpoint: notificationEmail.valueAsString!,
        });

        const spapiNotificationsDeadLetterQueue = new sqs.CfnQueue(this, 'SPAPINotificationsDeadLetterQueue', {
            queueName: [
                'sp-api-notifications-dead-letter-queue',
                props.randomSuffix!,
            ].join('-'),
            visibilityTimeout: 60,
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

        const spapiQueryItemsTable = new dynamodb.CfnTable(this, 'SPAPIQueryItemsTable', {
            tableName: [
                'SPAPIQueryItemsTable',
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


        // Lambda role

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

        const spapiDynamoDBReaderLambdaExecutionRole = new iam.CfnRole(this, 'SPAPIDynamoDBReaderLambdaExecutionRole', {
            roleName: [
                'SPAPIDynamoDBReaderLambdaExecutionRole',
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
                                Resource: spapiQueryItemsTable.attrArn,
                            },
                        ],
                    },
                },
            ],
        });

        const spapiStoreDocumentLambdaExecutionRole = new iam.CfnRole(this, 'SPAPIStoreDocumentLambdaExecutionRole', {
            roleName: [
                'SPAPIStoreDocumentLambdaExecutionRole',
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
                                    's3:PutObject',
                                    's3:GetObject',
                                ],
                                Resource: spapiEasyShipDocumentsS3Bucket.attrArn + '/*',
                            },
                        ],
                    },
                },
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


        // Lambda function
        const easyShipCreateScheduledPackageLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPCreateScheduledPackageLambdaFunction', {
            functionName: [
                'EASYSHIPCreateScheduledPackageLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Creating a scheduled package Lambda function for EasyShip.',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyshipCreateScheduledPackageLambdaFunctionHandler.valueAsString!,
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

        const easyShipGetFeedDocumentLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPGetFeedDocumentLambdaFunction', {
            functionName: [
                'EASYSHIPGetFeedDocumentLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Retrieves feed documents Lambda Function for EasyShip',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyShipGetFeedDocumentLambdaFunctionHandler.valueAsString!,
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

        const easyShipGetReportDocumentLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPGetReportDocumentLambdaFunction', {
            functionName: [
                'EASYSHIPGetReportDocumentLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Retrieve report documents Lambda Function for EasyShip',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyShipGetReportDocumentLambdaFunctionHandler.valueAsString!,
            role: spapiStoreDocumentLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'EASYSHIP_LABEL_DOCUMENTS_S3_BUCKET_NAME': spapiEasyShipDocumentsS3Bucket.ref,
                    'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
                },
            },
        });

        const easyShipGetScheduledPackageLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPGetScheduledPackageLambdaFunction', {
            functionName: [
                'EASYSHIPGetScheduledPackageLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Retrieve scheduled packages Lambda function for EasyShip',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyShipGetScheduledPackageLambdaFunctionHandler.valueAsString!,
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

        const easyShipInventoryCheckLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPInventoryCheckLambdaFunction', {
            functionName: [
                'EASYSHIPInventoryCheckLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Perform inventory checks Lambda Function for EasyShip',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyShipInventoryCheckLambdaFunctionHandler.valueAsString!,
            role: spapiDynamoDBReaderLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'SP_API_APP_CREDENTIALS_SECRET_ARN': spapiAppCredentials.ref,
                    'INVENTORY_TABLE_NAME': spapiQueryItemsTable.ref,
                },
            },
        });

        const easyShipListHandoverSlotsLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPListHandoverSlotsLambdaFunction', {
            functionName: [
                'EASYSHIPListHandoverSlotsLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Retrieves lists available handover slots Lambda Function for EasyShip',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyShipListHandoverSlotsLambdaFunctionHandler.valueAsString!,
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

        const easyShipRetrieveOrderLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPRetrieveOrderLambdaFunction', {
            functionName: [
                'EASYSHIPRetrieveOrderLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Retrieve order Lambda Function for EasyShip',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyShipRetrieveOrderLambdaFunctionHandler.valueAsString!,
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

        const easyShipSubmitFeedRequestLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPSubmitFeedRequestLambdaFunction', {
            functionName: [
                'EASYSHIPSubmitFeedRequestLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Submit feed request Lambda Function for EasyShip',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyShipSubmitFeedRequestLambdaFunctionHandler.valueAsString!,
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

        const easyShipSubscribeNotificationsLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPSubscribeNotificationsLambdaFunction', {
            functionName: [
                'EASYSHIPSubscribeNotificationsLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Subscribe notification Lambda Function for EasyShip',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyShipSubscribeNotificationsLambdaFunctionHandler.valueAsString!,
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
                    'SHIP_FROM_EMAIL': notificationEmail.valueAsString!,
                },
            },
        });



        // State machine
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
                                    easyShipListHandoverSlotsLambdaFunction.attrArn,
                                    easyShipRetrieveOrderLambdaFunction.attrArn,
                                    easyShipInventoryCheckLambdaFunction.attrArn,
                                    easyShipCreateScheduledPackageLambdaFunction.attrArn,
                                    easyShipGetScheduledPackageLambdaFunction.attrArn,
                                    easyShipSubmitFeedRequestLambdaFunction.attrArn,
                                    easyShipGetFeedDocumentLambdaFunction.attrArn,
                                    easyShipGetReportDocumentLambdaFunction.attrArn,
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
                                Resource: spApiNotificationSnsTopic.ref,
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
                ListHandoverSlotsLambdaFunctionArn: easyShipListHandoverSlotsLambdaFunction.attrArn,
                RetrieveOrderLambdaFunctionArn: easyShipRetrieveOrderLambdaFunction.attrArn,
                InventoryCheckLambdaFunctionArn: easyShipInventoryCheckLambdaFunction.attrArn,
                CreateScheduledPackageLambdaFunctionArn: easyShipCreateScheduledPackageLambdaFunction.attrArn,
                GetScheduledPackageLambdaFunctionArn: easyShipGetScheduledPackageLambdaFunction.attrArn,
                SubmitFeedRequestLambdaFunctionArn: easyShipSubmitFeedRequestLambdaFunction.attrArn,
                GetFeedDocumentLambdaFunctionArn: easyShipGetFeedDocumentLambdaFunction.attrArn,
                GetReportDocumentLambdaFunctionArn: easyShipGetReportDocumentLambdaFunction.attrArn,
                NotificationTopicArn: spApiNotificationSnsTopic.ref,
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

        const easyShipProcessNotificationLambdaFunction = new lambda.CfnFunction(this, 'EASYSHIPProcessNotificationLambdaFunction', {
            functionName: [
                'EASYSHIPProcessNotificationLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Process notifications Lambda function for EasyShip',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: easyShipProcessNotificationLambdaFunctionHandler.valueAsString!,
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
            functionName: easyShipProcessNotificationLambdaFunction.attrArn,
        });
    }
}
