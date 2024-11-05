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
import {ServerSideEncryption} from "aws-cdk-lib/aws-s3-deployment";

export interface SpApiAppCdkStackProps extends cdk.StackProps {
    readonly randomSuffix: string;
    readonly spApiCdkQualifier: string;
}

/**
 * This template creates the resources of an SP-API application
 */
export class SpApiAppCdkStack extends cdk.Stack {
    private readonly sellingPartnerAPINotificationPrincipal: string = '437568002678';

    public constructor(scope: cdk.App, id: string, props: SpApiAppCdkStackProps) {
        super(scope, id.concat("-", props.randomSuffix), {
            ...props, synthesizer: new DefaultStackSynthesizer({
                qualifier: props.spApiCdkQualifier
            })
        });

        //parameters

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

        const spApiRetrieveOrderLambdaFunctionHandler = new cdk.CfnParameter(this, 'spApiRetrieveOrderLambdaFunctionHandler', {
            type: 'String',
            description: "Handler of Retrieve Order Lambda Function"
        });

        const spApiInventoryCheckLambdaFunctionHandler = new cdk.CfnParameter(this, 'spApiInventoryCheckLambdaFunctionHandler', {
            type: 'String',
            description: "Handler of Inventory Check Lambda Function"
        });

        const spApiEligibleShipmentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spApiEligibleShipmentLambdaFunctionHandler', {
            type: 'String',
            description: "Handler of Eligible Shipment Lambda Function"
        });

        const spApiSelectShipmentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spApiSelectShipmentLambdaFunctionHandler', {
            type: 'String',
            description: "Handler of Select Shipment Lambda Function"
        });

        const spApiCreateShipmentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spApiCreateShipmentLambdaFunctionHandler', {
            type: 'String',
            description: "Handler of Create Shipment Lambda Function"
        });

        const spApiPresignS3LabelLambdaFunctionHandler = new cdk.CfnParameter(this, 'spApiPresignS3LabelLambdaFunctionHandler', {
            type: 'String',
            description: "Handler of Presign S3 Label Lambda Function"
        });

        const spApiProcessNotificationLambdaFunctionHandler = new cdk.CfnParameter(this, 'spApiProcessNotificationLambdaFunctionHandler', {
            type: 'String',
            description: "Handler of Process Notification Lambda Function"
        });

        const spApiSubscribeNotificationsLambdaFunctionHandler = new cdk.CfnParameter(this, 'spApiSubscribeNotificationsLambdaFunctionHandler', {
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


        // Resources
        const spApiAppCredentials = new secretsmanager.CfnSecret(this, 'SPAPIAppCredentials', {
            name: [
                'SPAPIAppCredentials',
                props.randomSuffix!,
            ].join('-'),
            description: 'Secret containing SP-API app credentials',
            secretString: `{"AppClientId": "${clientId.valueAsString!}", "AppClientSecret": "${clientSecret.valueAsString!}"}`,
        });

        const spapiInventoryTable = new dynamodb.CfnTable(this, 'SPAPIInventoryTable', {
            tableName: [
                'SPAPIInventory',
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
                            sseAlgorithm: ServerSideEncryption.AES_256,
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

        const spApiNotificationsDeadLetterQueue = new sqs.CfnQueue(this, 'SPAPINotificationsDeadLetterQueue', {
            queueName: [
                'sp-api-notifications-dead-letter-queue',
                props.randomSuffix!,
            ].join('-'),
            visibilityTimeout: 60,
        });

        const spApiShipmentsTable = new dynamodb.CfnTable(this, 'SPAPIShipmentsTable', {
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
        });

        const spApiLambdaExecutionRole = new iam.CfnRole(this, 'SPAPILambdaExecutionRole', {
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
                                    spApiAppCredentials.ref,
                                ],
                            },
                        ],
                    },
                },
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
                {
                    policyName: 'DynamoDBWriterPolicy',
                    policyDocument: {
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Effect: 'Allow',
                                Action: 'dynamodb:PutItem',
                                Resource: spApiShipmentsTable.attrArn,
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
                                Resource: spApiLabelsS3Bucket.attrArn,
                            },
                        ],
                    },
                },
            ],
        });

        const spApiNotificationSubscription = new sns.CfnSubscription(this, 'SPAPINotificationSubscription', {
            topicArn: spApiNotificationSnsTopic.ref,
            protocol: 'email',
            endpoint: notificationEmail.valueAsString!,
        });

        const spApiNotificationsQueue = new sqs.CfnQueue(this, 'SPAPINotificationsQueue', {
            queueName: [
                'sp-api-notifications-queue',
                props.randomSuffix!,
            ].join('-'),
            visibilityTimeout: 60,
            redrivePolicy: {
                deadLetterTargetArn: spApiNotificationsDeadLetterQueue.attrArn,
                maxReceiveCount: 5,
            },
        });

        const spApiCreateShipmentLambdaFunction = new lambda.CfnFunction(this, 'SPAPICreateShipmentLambdaFunction', {
            functionName: [
                'SPAPICreateShipmentLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Create Shipment Lambda function',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: spApiCreateShipmentLambdaFunctionHandler.valueAsString!,
            role: spApiLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'SP_API_APP_CREDENTIALS_SECRET_ARN': spApiAppCredentials.ref,
                    'SHIPMENTS_TABLE_NAME': spApiShipmentsTable.ref,
                },
            },
        });

        const spApiEligibleShipmentLambdaFunction = new lambda.CfnFunction(this, 'SPAPIEligibleShipmentLambdaFunction', {
            functionName: [
                'SPAPIEligibleShipmentLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Eligible Shipment Lambda function',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: spApiEligibleShipmentLambdaFunctionHandler.valueAsString!,
            role: spApiLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'SP_API_APP_CREDENTIALS_SECRET_ARN': spApiAppCredentials.ref,
                },
            },
        });

        const spApiInventoryCheckLambdaFunction = new lambda.CfnFunction(this, 'SPAPIInventoryCheckLambdaFunction', {
            functionName: [
                'SPAPIInventoryCheckLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Inventory Check Lambda function',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: spApiInventoryCheckLambdaFunctionHandler.valueAsString!,
            role: spApiLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'SP_API_APP_CREDENTIALS_SECRET_ARN': spApiAppCredentials.ref,
                    'INVENTORY_TABLE_NAME': spapiInventoryTable.ref,
                },
            },
        });

        const spApiNotificationsQueuePolicy = new sqs.CfnQueuePolicy(this, 'SPAPINotificationsQueuePolicy', {
            queues: [
                spApiNotificationsQueue.ref,
            ],
            policyDocument: {
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: [
                            'SQS:SendMessage',
                            'SQS:GetQueueAttributes',
                        ],
                        Resource: spApiNotificationsQueue.attrArn,
                        Principal: {
                            AWS: [
                                this.sellingPartnerAPINotificationPrincipal,
                            ],
                        },
                    },
                ],
            },
        });

        const spApiPresignS3LabelLambdaFunction = new lambda.CfnFunction(this, 'SPAPIPresignS3LabelLambdaFunction', {
            functionName: [
                'SPAPIPresignS3LabelLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Presign S3 Label Lambda function',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: spApiPresignS3LabelLambdaFunctionHandler.valueAsString!,
            role: spApiLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'SP_API_APP_CREDENTIALS_SECRET_ARN': spApiAppCredentials.ref,
                    'LABELS_S3_BUCKET_NAME': spApiLabelsS3Bucket.ref,
                },
            },
        });

        const spApiRetrieveOrderLambdaFunction = new lambda.CfnFunction(this, 'SPAPIRetrieveOrderLambdaFunction', {
            functionName: [
                'SPAPIRetrieveOrderLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Retrieve Order Lambda function',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: spApiRetrieveOrderLambdaFunctionHandler.valueAsString!,
            role: spApiLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'SP_API_APP_CREDENTIALS_SECRET_ARN': spApiAppCredentials.ref,
                    'SHIP_FROM_EMAIL': notificationEmail.valueAsString!,
                },
            },
        });

        const spApiSelectShipmentLambdaFunction = new lambda.CfnFunction(this, 'SPAPISelectShipmentLambdaFunction', {
            functionName: [
                'SPAPISelectShipmentLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Select Shipment Lambda function',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: spApiSelectShipmentLambdaFunctionHandler.valueAsString!,
            role: spApiLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'SP_API_APP_CREDENTIALS_SECRET_ARN': spApiAppCredentials.ref,
                    'SHIPMENT_FILTER_TYPE': 'CHEAPEST',
                },
            },
        });

        const spApiSubscribeNotificationsLambdaFunction = new lambda.CfnFunction(this, 'SPAPISubscribeNotificationsLambdaFunction', {
            functionName: [
                'SPAPISubscribeNotificationsLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Subscribe Notifications Lambda function',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: spApiSubscribeNotificationsLambdaFunctionHandler.valueAsString!,
            role: spApiLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'SP_API_APP_CREDENTIALS_SECRET_ARN': spApiAppCredentials.ref,
                    'SQS_QUEUE_ARN': spApiNotificationsQueue.attrArn,
                },
            },
        });

        const spApiStateMachineExecutionRole = new iam.CfnRole(this, 'SPAPIStateMachineExecutionRole', {
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
                                    spApiRetrieveOrderLambdaFunction.attrArn,
                                    spApiInventoryCheckLambdaFunction.attrArn,
                                    spApiEligibleShipmentLambdaFunction.attrArn,
                                    spApiSelectShipmentLambdaFunction.attrArn,
                                    spApiCreateShipmentLambdaFunction.attrArn,
                                    spApiPresignS3LabelLambdaFunction.attrArn,
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

        const spApiStateMachine = new stepfunctions.CfnStateMachine(this, 'SPAPIStateMachine', {
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
                RetrieveOrderLambdaFunctionArn: spApiRetrieveOrderLambdaFunction.attrArn,
                InventoryCheckLambdaFunctionArn: spApiInventoryCheckLambdaFunction.attrArn,
                EligibleShipmentLambdaFunctionArn: spApiEligibleShipmentLambdaFunction.attrArn,
                SelectShipmentLambdaFunctionArn: spApiSelectShipmentLambdaFunction.attrArn,
                CreateShipmentLambdaFunctionArn: spApiCreateShipmentLambdaFunction.attrArn,
                PresignS3LabelLambdaFunctionArn: spApiPresignS3LabelLambdaFunction.attrArn,
                NotificationTopicArn: spApiNotificationSnsTopic.ref,
            },
            roleArn: spApiStateMachineExecutionRole.attrArn,
        });

        const spApiNotificationsLambdaExecutionRole = new iam.CfnRole(this, 'SPAPINotificationsLambdaExecutionRole', {
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
                                Resource: spApiNotificationsQueue.attrArn,
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
                                Resource: spApiStateMachine.ref,
                            },
                        ],
                    },
                },
            ],
        });

        const spApiProcessNotificationLambdaFunction = new lambda.CfnFunction(this, 'SPAPIProcessNotificationLambdaFunction', {
            functionName: [
                'SPAPIProcessNotificationLambdaFunction',
                props.randomSuffix!,
            ].join('-'),
            description: 'Process Notifications Lambda function',
            code: {
                s3Bucket: artifactsS3BucketName.valueAsString!,
                s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
            },
            handler: spApiProcessNotificationLambdaFunctionHandler.valueAsString!,
            role: spApiNotificationsLambdaExecutionRole.attrArn,
            runtime: programmingLanguage.valueAsString!,
            memorySize: 512,
            timeout: 60,
            environment: {
                variables: {
                    'STATE_MACHINE_ARN': spApiStateMachine.ref,
                    'REFRESH_TOKEN': refreshToken.valueAsString!,
                    'REGION_CODE': regionCode.valueAsString,
                },
            },
        });

        const spApiNotificationsEventSourceMapping = new lambda.CfnEventSourceMapping(this, 'SPAPINotificationsEventSourceMapping', {
            batchSize: 1,
            enabled: true,
            eventSourceArn: spApiNotificationsQueue.attrArn,
            functionName: spApiProcessNotificationLambdaFunction.attrArn,
        });
    }
}
