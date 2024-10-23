import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
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

		const lambdaFunctionsCodeS3Key = new cdk.CfnParameter(this, 'lambdaFunctionsCodeS3Key', {
			type: 'String',
			description: "Key of the S3 file containing the Lambda functions code"
		});

		const stepFunctionsStateMachineDefinitionS3Key = new cdk.CfnParameter(this, 'stepFunctionsStateMachineDefinitionS3Key', {
			type: 'String',
            noEcho: true,
			description: "Key of the S3 file containing the Step Functions state machine definition"
		});

		const spapiCreateQueryLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiCreateQueryLambdaFunctionHandler', {
		  type: 'String',
          noEcho: true,
		  description: "Handler of Creating a Query Lambda Function"
		});

		const spapiCreateScheduleLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiCreateScheduleLambdaFunctionHandler', {
		  type: 'String',
          noEcho: true,
		  description: "Handler of Creating the Scheduled Query Lambda Function"
		});

		const spapiDeleteScheduleLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiDeleteScheduleLambdaFunctionHandler', {
		  type: 'String',
          noEcho: true,
		  description: "Handler of Deleting the Scheduled Query Lambda Function"
		});

		const spapiFormatScheduleLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiFormatScheduleLambdaFunctionHandler', {
		  type: 'String',
          noEcho: true,
		  description: "Handler of Formating a Schedule for a Query Lambda Function"
		});

		const spapiCancelQueryLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiCancelQueryLambdaFunctionHandler', {
		  type: 'String',
          noEcho: true,
		  description: "Handler of Canceling the Query Lambda Function"
		});

		const spapiProcessNotificationLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiProcessNotificationLambdaFunctionHandler', {
		  type: 'String',
          noEcho: true,
		  description: "Handler of Process Notification Lambda Function"
		});

		const spapiSubscribeNotificationsLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiSubscribeNotificationsLambdaFunctionHandler', {
		  type: 'String',
          noEcho: true,
		  description: "Handler of Subscribe Notifications Lambda Function"
		});

		const spapiGetDocumentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiGetDocumentLambdaFunctionHandler', {
		  type: 'String',
          noEcho: true,
		  description: "Handler of Getting Document information Lambda Function"
		});

		const spapiStoreDocumentLambdaFunctionHandler = new cdk.CfnParameter(this, 'spapiStoreDocumentLambdaFunctionHandler', {
		  type: 'String',
          noEcho: true,
		  description: "Handler of Storing Document information Lambda Function"
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

	const spapiCreateScheduleRole = new iam.CfnRole(this, 'SPAPICreateScheduleRole', {
	  roleName: [
		'SPAPICreateScheduleRole',
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
		  policyName: 'LambdaInvokePolicy',
		  policyDocument: {
			Version: '2012-10-17',
			Statement: [
			  {
				Effect: 'Allow',
				Action: [
				  'lambda:InvokeFunction',
				],
				Resource: '*',
			  },
			],
		  },
		},
	  ],
	});

	const spapiDataKioskDocumentsS3Bucket = new s3.CfnBucket(this, 'SPAPIDataKioskDocumentsS3Bucket', {
	  publicAccessBlockConfiguration: {
		blockPublicAcls: true,
		ignorePublicAcls: true,
		blockPublicPolicy: true,
		restrictPublicBuckets: true,
	  },
	  bucketName: [
		'sp-api-dk-documents-s3-bucket',
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

	const spapiNotificationsDeadLetterQueue = new sqs.CfnQueue(this, 'SPAPINotificationsDeadLetterQueue', {
	  queueName: [
		'sp-api-notifications-dead-letter-queue',
		props.randomSuffix!,
	  ].join('-'),
	  visibilityTimeout: 60,
	});

	const spapiQueryItemsTable = new dynamodb.CfnTable(this, 'SPAPIQueryItemsTable', {
	  tableName: [
		'SPAPIQueryItemsTable',
		props.randomSuffix!,
	  ].join('-'),
	  attributeDefinitions: [
		{
		  attributeName: 'AccountId',
		  attributeType: 'S',
		},
		{
		  attributeName: 'QueryId',
		  attributeType: 'S',
		},
	  ],
	  keySchema: [
		{
		  attributeName: 'AccountId',
		  keyType: 'HASH',
		},
		{
		  attributeName: 'QueryId',
		  keyType: 'RANGE',
		},
	  ],
	  billingMode: 'PAY_PER_REQUEST',
	  pointInTimeRecoverySpecification: {
		pointInTimeRecoveryEnabled: true,
	  },
	});

	const spapiScheduledQueriesTable = new dynamodb.CfnTable(this, 'SPAPIScheduledQueriesTable', {
	  tableName: [
		'SPAPIScheduledQueriesTable',
		props.randomSuffix!,
	  ].join('-'),
	  attributeDefinitions: [
		{
		  attributeName: 'AccountId',
		  attributeType: 'S',
		},
		{
		  attributeName: 'QueryHash',
		  attributeType: 'S',
		},
	  ],
	  keySchema: [
		{
		  attributeName: 'AccountId',
		  keyType: 'HASH',
		},
		{
		  attributeName: 'QueryHash',
		  keyType: 'RANGE',
		},
	  ],
	  billingMode: 'PAY_PER_REQUEST',
	  pointInTimeRecoverySpecification: {
		pointInTimeRecoveryEnabled: true,
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
	  ],
	});

	const spapiManageScheduleLambdaExecutionRole = new iam.CfnRole(this, 'SPAPIManageScheduleLambdaExecutionRole', {
	  roleName: [
		'SPAPIManageScheduleLambdaExecutionRole',
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
		  policyName: 'DynamoDBWriterPolicy',
		  policyDocument: {
			Version: '2012-10-17',
			Statement: [
			  {
				Effect: 'Allow',
				Action: 'dynamodb:PutItem',
				Resource: spapiScheduledQueriesTable.attrArn,
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
				Action: 'dynamodb:Query',
				Resource: spapiScheduledQueriesTable.attrArn,
			  },
			],
		  },
		},
		{
		  policyName: 'DynamoDBDeleterPolicy',
		  policyDocument: {
			Version: '2012-10-17',
			Statement: [
			  {
				Effect: 'Allow',
				Action: 'dynamodb:DeleteItem',
				Resource: spapiScheduledQueriesTable.attrArn,
			  },
			],
		  },
		},
		{
		  policyName: 'LambdaPolicy',
		  policyDocument: {
			Version: '2012-10-17',
			Statement: [
			  {
				Effect: 'Allow',
				Action: [
				  'lambda:InvokeFunction',
				],
				Resource: '*',
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
				  'scheduler:DeleteSchedule',
				  'scheduler:DeleteScheduleGroup',
				  'scheduler:CreateSchedule',
				  'scheduler:CreateScheduleGroup',
				  'scheduler:ListScheduleGroups',
				  'scheduler:GetScheduleGroup',
				  'scheduler:TagResource',
				  'iam:PassRole',
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
		maxReceiveCount: 3,
	  },
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
		  policyName: 'DynamoDBWriterPolicy',
		  policyDocument: {
			Version: '2012-10-17',
			Statement: [
			  {
				Effect: 'Allow',
				Action: 'dynamodb:PutItem',
				Resource: spapiQueryItemsTable.attrArn,
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
				  's3:PutObject',
				],
				Resource: spapiDataKioskDocumentsS3Bucket.attrArn + '/*',
			  },
			],
		  },
		},
	  ],
	});

	const spapiCancelQueryLambdaFunction = new lambda.CfnFunction(this, 'SPAPICancelQueryLambdaFunction', {
	  functionName: [
		'SPAPICancelQueryLambdaFunction',
		props.randomSuffix!,
	  ].join('-'),
	  description: 'Cancel the GraphQL Query Lambda Function',
	  code: {
		s3Bucket: artifactsS3BucketName.valueAsString!,
		s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
	  },
	  handler: spapiCancelQueryLambdaFunctionHandler.valueAsString!,
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

	const spapiCreateQueryLambdaFunction = new lambda.CfnFunction(this, 'SPAPICreateQueryLambdaFunction', {
	  functionName: [
		'SPAPICreateQueryLambdaFunction',
		props.randomSuffix!,
	  ].join('-'),
	  description: 'Create the GraphQL Query Lambda Function',
	  code: {
		s3Bucket: artifactsS3BucketName.valueAsString!,
		s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
	  },
	  handler: spapiCreateQueryLambdaFunctionHandler.valueAsString!,
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

	const spapiGetDocumentLambdaFunction = new lambda.CfnFunction(this, 'SPAPIGetDocumentLambdaFunction', {
	  functionName: [
		'SPAPIGetDocumentLambdaFunction',
		props.randomSuffix!,
	  ].join('-'),
	  description: 'Get Document information Lambda Function',
	  code: {
		s3Bucket: artifactsS3BucketName.valueAsString!,
		s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
	  },
	  handler: spapiGetDocumentLambdaFunctionHandler.valueAsString!,
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

	const spapiStoreDocumentLambdaFunction = new lambda.CfnFunction(this, 'SPAPIStoreDocumentLambdaFunction', {
	  functionName: [
		'SPAPIStoreDocumentLambdaFunction',
		props.randomSuffix!,
	  ].join('-'),
	  description: 'Store Document information Lambda Function',
	  code: {
		s3Bucket: artifactsS3BucketName.valueAsString!,
		s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
	  },
	  handler: spapiStoreDocumentLambdaFunctionHandler.valueAsString!,
	  role: spapiStoreDocumentLambdaExecutionRole.attrArn,
	  runtime: programmingLanguage.valueAsString!,
	  memorySize: 512,
	  timeout: 60,
	  environment: {
		variables: {
		  'QUERY_ITEMS_TABLE_NAME': spapiQueryItemsTable.ref,
		  'DATAKIOSK_DOCUMENTS_S3_BUCKET_NAME': spapiDataKioskDocumentsS3Bucket.ref,
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

	const spapiFormatScheduleLambdaFunction = new lambda.CfnFunction(this, 'SPAPIFormatScheduleLambdaFunction', {
	  functionName: [
		'SPAPIFormatScheduleLambdaFunction',
		props.randomSuffix!,
	  ].join('-'),
	  description: 'Format the Schedule for GraphQL Query Lambda Function',
	  code: {
		s3Bucket: artifactsS3BucketName.valueAsString!,
		s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
	  },
	  handler: spapiFormatScheduleLambdaFunctionHandler.valueAsString!,
	  role: spapiManageScheduleLambdaExecutionRole.attrArn,
	  runtime: programmingLanguage.valueAsString!,
	  memorySize: 512,
	  timeout: 60,
	  environment: {
		variables: {
		  'CREATE_QUERY_LAMBDA_FUNCTION_ARN': spapiCreateQueryLambdaFunction.attrArn,
		  'CREATE_SCHEDULE_ROLE_ARN': spapiCreateScheduleRole.attrArn,
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
				  spapiGetDocumentLambdaFunction.attrArn,
				  spapiStoreDocumentLambdaFunction.attrArn,
				],
			  },
			],
		  },
		},
	  ],
	});

	const spapiCreateScheduleLambdaFunction = new lambda.CfnFunction(this, 'SPAPICreateScheduleLambdaFunction', {
	  functionName: [
		'SPAPICreateScheduleLambdaFunction',
		props.randomSuffix!,
	  ].join('-'),
	  description: 'Create the Schedule for GraphQL Query Lambda Function',
	  code: {
		s3Bucket: artifactsS3BucketName.valueAsString!,
		s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
	  },
	  handler: spapiCreateScheduleLambdaFunctionHandler.valueAsString!,
	  role: spapiManageScheduleLambdaExecutionRole.attrArn,
	  runtime: programmingLanguage.valueAsString!,
	  memorySize: 512,
	  timeout: 60,
	  environment: {
		variables: {
		  'SCHEDULED_QUERIES_TABLE_NAME': spapiScheduledQueriesTable.ref,
		  'RANDOM_SUFFIX': props.randomSuffix!,
		  'FORMAT_SCHEDULE_LAMBDA_FUNCTION_ARN': spapiFormatScheduleLambdaFunction.attrArn,
		  'CREATE_SCHEDULE_ROLE_ARN': spapiCreateScheduleRole.attrArn,
		},
	  },
	});

	const spapiDeleteScheduleLambdaFunction = new lambda.CfnFunction(this, 'SPAPIDeleteScheduleLambdaFunction', {
	  functionName: [
		'SPAPIDeleteScheduleLambdaFunction',
		props.randomSuffix!,
	  ].join('-'),
	  description: 'Delete the Schedule for GraphQL Query Lambda Function',
	  code: {
		s3Bucket: artifactsS3BucketName.valueAsString!,
		s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
	  },
	  handler: spapiDeleteScheduleLambdaFunctionHandler.valueAsString!,
	  role: spapiManageScheduleLambdaExecutionRole.attrArn,
	  runtime: programmingLanguage.valueAsString!,
	  memorySize: 512,
	  timeout: 60,
	  environment: {
		variables: {
		  'SCHEDULED_QUERIES_TABLE_NAME': spapiScheduledQueriesTable.ref,
		  'RANDOM_SUFFIX': props.randomSuffix!,
		  'FORMAT_SCHEDULE_LAMBDA_FUNCTION_ARN': spapiFormatScheduleLambdaFunction.attrArn,
		  'CREATE_SCHEDULE_ROLE_ARN': spapiCreateScheduleRole.attrArn,
		},
	  },
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
		GetDocumentLambdaFunctionArn: spapiGetDocumentLambdaFunction.attrArn,
		StoreDocumentLambdaFunctionArn: spapiStoreDocumentLambdaFunction.attrArn,
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
