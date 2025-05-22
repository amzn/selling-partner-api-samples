import * as cdk from 'aws-cdk-lib';
import {CfnParameter, DefaultStackSynthesizer, Duration, Stack} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';

interface NotificationResourceInfo {
	notificationType: string;
	resource: string;
}

export interface SpApiAppCdkStackProps extends cdk.StackProps {
	readonly randomSuffix: string;
	readonly spApiCdkQualifier: string;
}

/**
 * This template creates the resources of an SP-API application
 */
export class SpApiAppCdkStack extends Stack {
	constructor(scope: Construct, id: string, props: SpApiAppCdkStackProps) {
		super(scope, id.concat("-", props.randomSuffix), {
			...props, synthesizer: new DefaultStackSynthesizer({
				qualifier: props.spApiCdkQualifier
			})
		});

		const artifactsS3BucketName = new CfnParameter(this, 'artifactsS3BucketName', {
			type: 'String',
			noEcho: true,
			description: "Name of the S3 bucket containing the application's artifacts"
		});

		const spapiDefaultWebHookSqsNotificationHandler = new CfnParameter(this, 'spapiDefaultWebHookSqsNotificationHandler', {
			type: 'String',
			noEcho: true,
			description: "Default WebHook Handler for SQS Notification Lambda Function"
		});

		const spapiDefaultWebHookEventBridgeNotificationHandler = new CfnParameter(this, 'spapiDefaultWebHookEventBridgeNotificationHandler', {
			type: 'String',
			noEcho: true,
			description: "Default WebHook Handler for EventBridge Notification Lambda Function"
		});

		const spapiDefaultWebHookSqsReprocessHandler = new CfnParameter(this, 'spapiDefaultWebHookSqsReprocessHandler', {
			type: 'String',
			noEcho: true,
			description: "Default WebHook Handler for DLQ SQS Reprocess Lambda Function"
		});

		const spapiDefaultCrossPlatformSqsNotificationHandler = new CfnParameter(this, 'spapiDefaultCrossPlatformSqsNotificationHandler', {
			type: 'String',
			noEcho: true,
			description: "Default CrossPlatform Handler for SQS Notification Lambda Function"
		});

		const spapiDefaultCrossPlatformEventBridgeNotificationHandler = new CfnParameter(this, 'spapiDefaultCrossPlatformEventBridgeNotificationHandler', {
			type: 'String',
			noEcho: true,
			description: "Default CrossPlatform Handler for EventBridge Notification Lambda Function"
		});

		const spapiDefaultCrossPlatformSqsReprocessHandler = new CfnParameter(this, 'spapiDefaultCrossPlatformSqsReprocessHandler', {
			type: 'String',
			noEcho: true,
			description: "Default CrossPlatform Handler for DLQ SQS Reprocess Lambda Function"
		});

		const spapiDefaultInternalSqsNotificationHandler = new CfnParameter(this, 'spapiDefaultInternalSqsNotificationHandler', {
			type: 'String',
			noEcho: true,
			description: "Default CrossPlatform Handler for SQS Notification Lambda Function"
		});

		const spapiDefaultInternalEventBridgeNotificationHandler = new CfnParameter(this, 'spapiDefaultInternalEventBridgeNotificationHandler', {
			type: 'String',
			noEcho: true,
			description: "Default CrossPlatform Handler for EventBridge Notification Lambda Function"
		});

		const spapiDefaultInternalSqsReprocessHandler = new CfnParameter(this, 'spapiDefaultInternalSqsReprocessHandler', {
			type: 'String',
			noEcho: true,
			description: "Default CrossPlatform Handler for DLQ SQS Reprocess Lambda Function"
		});

		const spapiSubscribeNotificationsLambdaFunctionHandler = new CfnParameter(this, 'spapiSubscribeNotificationsLambdaFunctionHandler', {
			type: 'String',
			noEcho: true,
			description: "Handler of Subscribe SQS/EventBridge Notifications Lambda Function"
		});

		const spapiUnsubscribeNotificationsLambdaFunctionHandler = new CfnParameter(this, 'spapiUnsubscribeNotificationsLambdaFunctionHandler', {
			type: 'String',
			noEcho: true,
			description: "Handler of Unsubscribe SQS/EventBridge Notifications Lambda Function"
		});

		const RUNTIME_MAP: { [key: string]: lambda.Runtime } = {
			'nodejs18.x': lambda.Runtime.NODEJS_18_X,
			'nodejs20.x': lambda.Runtime.NODEJS_20_X,
			'python3.11': lambda.Runtime.PYTHON_3_11,
			'java17': lambda.Runtime.JAVA_17,
		};

		const lang = this.node.tryGetContext('PROGRAMMING_LANGUAGE');
		const runtime = RUNTIME_MAP[lang.toLowerCase()];
		if (!runtime) {
			throw new Error(`Unsupported runtime: ${lang}`);
		}

		// DynamoDB to store subscription info
		const spapiNotificationSubscriptionTable = new dynamodb.Table(this, 'SPAPINotificationSubscriptionTable', {
			tableName: `SPAPINotificationSubscriptionTable-${props.randomSuffix}`,
			partitionKey: { name: 'SubscriptionId', type: dynamodb.AttributeType.STRING },
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			pointInTimeRecovery: true,
			removalPolicy: cdk.RemovalPolicy.DESTROY,
		});

		// Lambda Subscriber role
		const spapiSubscribeLambdaExecutionRole = new iam.Role(this, 'spapiSubscribeLambdaExecutionRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
			],
		});

		// SecretsManager Read policy
		spapiSubscribeLambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
			actions: ['secretsmanager:GetSecretValue'],
			resources: [
				`arn:${this.partition}:secretsmanager:${this.region}:${this.account}:secret:SPAPIAppCredentials-*`,
				`arn:${this.partition}:secretsmanager:${this.region}:${this.account}:secret:SPAPISecretArn-*`,
			],
		}));

		// DynamoDB Write policy
		spapiSubscribeLambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
			actions: ['dynamodb:PutItem', 'dynamodb:DeleteItem','dynamodb:Scan'],
			resources: [spapiNotificationSubscriptionTable.tableArn],
		}));

		// Lambda Processor role
		const spapiProcessNotificationsLambdaExecutionRole = this.createProcessNotificationsLambdaRole(
			props.randomSuffix,
			spapiNotificationSubscriptionTable.tableArn,
			'SPAPIProcessNotificationsLambdaExecutionRole'
		);

		// Lambda code
		const lambdaCode = lambda.Code.fromBucket(
			s3.Bucket.fromBucketName(this, 'ArtifactsBucket', artifactsS3BucketName.valueAsString),
			this.node.tryGetContext('LAMBDA_CODE_S3_KEY')
		);

		// Read app-config.json value
		const appConfig = JSON.parse(this.node.tryGetContext('APP_CONFIG'));
		// Read notification-type-definition.json value
		const notificationTypeDefinition = JSON.parse(this.node.tryGetContext('NOTIFICATION_TYPE_DEF_JSON'));

		const commonNotificationTypes: string[] = appConfig.NotificationTypes || [];
		const notificationResources: NotificationResourceInfo[] = [];
		const eventBusArn = this.node.tryGetContext('EVENT_BUS_ARN');
		let eventBus: events.IEventBus | undefined = undefined;
		if (commonNotificationTypes) {
			if (eventBusArn) {
				eventBus = events.EventBus.fromEventBusArn(this, 'SPAPIImportedEventBus', eventBusArn);
			}
			commonNotificationTypes.forEach((notification: any) => {
				const type = notification.NotificationType;
				if (
					!notificationTypeDefinition.Sqs.includes(type) &&
					!notificationTypeDefinition.EventBridge.includes(type)
				) {
					throw new Error(`Unsupported NotificationType detected: ${type}`);
				}

				const useSQS = notificationTypeDefinition.Sqs.includes(type);
				const webHook = notification.WebHook;
				const crossPlatform = notification.CrossPlatform;
				const internal = notification.Internal;

				const handler = webHook
					? useSQS
						? spapiDefaultWebHookSqsNotificationHandler.valueAsString!
						: spapiDefaultWebHookEventBridgeNotificationHandler.valueAsString!
					: crossPlatform
						? useSQS
							? spapiDefaultCrossPlatformSqsNotificationHandler.valueAsString!
							: spapiDefaultCrossPlatformEventBridgeNotificationHandler.valueAsString!
						: useSQS
							? spapiDefaultInternalSqsNotificationHandler.valueAsString!
							: spapiDefaultInternalEventBridgeNotificationHandler.valueAsString!;

				const dlqHandler = webHook
					? spapiDefaultWebHookSqsReprocessHandler.valueAsString!
					: crossPlatform
						? spapiDefaultCrossPlatformSqsReprocessHandler.valueAsString!
						: spapiDefaultInternalSqsReprocessHandler.valueAsString!;

				const result = this.createNotificationResources(
					type,
					useSQS,
					webHook,
					crossPlatform,
					internal,
					handler,
					dlqHandler,
					spapiProcessNotificationsLambdaExecutionRole,
					runtime,
					lambdaCode,
					props.randomSuffix!,
					artifactsS3BucketName,
					spapiNotificationSubscriptionTable,
					useSQS ? undefined : eventBus,
					eventBusArn
				);
				notificationResources.push(result);
			});
		}

		const notificationResourceMap: { [type: string]: string } = {};
		notificationResources.forEach(entry => {
			notificationResourceMap[entry.notificationType] = entry.resource;
		});

		const eventBusDestinationId = this.node.tryGetContext('DESTINATION_ID');
		const notificationTypeDefJson = this.node.tryGetContext('NOTIFICATION_TYPE_DEF_JSON');

		// Create Notification Subscriber  lambda
		const spapiSubscribeNotificationsLambdaFunction = new lambda.Function(this, 'SPAPISubscribeNotificationsLambdaFunction', {
			functionName: `SPAPISubscribeNotificationsLambdaFunction-${props.randomSuffix}`,
			description: 'Subscribe Notifications for SQS and EventBridge Lambda function',
			runtime: runtime,
			handler: spapiSubscribeNotificationsLambdaFunctionHandler.valueAsString,
			code: lambdaCode,
			memorySize: 512,
			timeout: cdk.Duration.seconds(60),
			role: spapiSubscribeLambdaExecutionRole,
			environment: {
				AGGREGATED_SECRET_NAMES: this.node.tryGetContext('CHUNKED_SECRET_NAMES'),
				NOTIFICATION_RESOURCES: JSON.stringify(notificationResourceMap),
				CLIENT_TABLE_NAME: spapiNotificationSubscriptionTable.tableName,
				EVENT_BUS_DESTINATION_ID: eventBusDestinationId,
				NOTIFICATION_TYPE_DEFINITION: notificationTypeDefJson,
			},
		});

		const spapiUnsubscribeNotificationsLambdaFunction = new lambda.Function(this, 'SPAPIUnsubscribeNotificationsLambdaFunction', {
			functionName: `SPAPIUnsubscribeNotificationsLambdaFunction-${props.randomSuffix}`,
			description: 'Unsubscribe Notifications for SQS and EventBridge Lambda function',
			runtime: runtime,
			handler: spapiUnsubscribeNotificationsLambdaFunctionHandler.valueAsString,
			code: lambdaCode,
			memorySize: 512,
			timeout: cdk.Duration.seconds(60),
			role: spapiSubscribeLambdaExecutionRole,
			environment: {
				CLIENT_TABLE_NAME: spapiNotificationSubscriptionTable.tableName,
				NOTIFICATION_TYPE_DEFINITION: notificationTypeDefJson,
			},
		});
	}

	private createNotificationResources(
		notificationType: string,
		useSQS: boolean,
		webHook: any,
		crossPlatform: any,
		internal: any,
		handler: string,
		dlqHandler: string,
		role: iam.Role,
		runtime: lambda.Runtime,
		code: lambda.Code,
		randomSuffix: string,
		artifactsS3BucketName: cdk.CfnParameter,
		spapiNotificationSubscriptionTable: dynamodb.Table,
		eventBus?: events.IEventBus,
		eventBusArn?: string
	): NotificationResourceInfo {
		// Define env value based on app-config
		const environment = this.buildEnvironment(webHook, crossPlatform, internal, spapiNotificationSubscriptionTable.tableName, notificationType);
		// Define handler based on app-config
		const resolvedHandler = this.resolveHandler(webHook, crossPlatform, internal, handler);
		// Define DLQ handler based on app-config
		const resolvedDlqHandler = this.resolveDlqHandler(webHook, crossPlatform, internal, dlqHandler);

		// Add required role based on app-config for crossPlatform
		this.addRolePoliciesForCrossPlatformIfNeeded(role, crossPlatform);

		// Add required role and environment values based on app-config for Internal
		const stepFns = this.buildStateMachineForInternalIfNeeded(
			role,
			internal,
			environment,
			runtime,
			code,
			randomSuffix,
			notificationType,
			artifactsS3BucketName,
			spapiNotificationSubscriptionTable.tableArn);

		if (stepFns) {
			for (const [workflowName, stateMachine] of Object.entries(stepFns)) {
				environment[`STATE_MACHINE_ARN_${workflowName.toUpperCase()}`] = stateMachine.attrArn;
			}
		}

		// Lambda definition
		const lambdaFunction = this.createLambdaFunction(notificationType, resolvedHandler, environment, role, runtime, code, randomSuffix, false);

		if (useSQS) {
			// Create DLQ
			const dlq = new sqs.Queue(this, `SP-API-DLQ-${notificationType}`, {
				queueName: `sp-api-dead-letter-queue-${notificationType}-${randomSuffix}`,
				visibilityTimeout: Duration.minutes(6) // To be aligned with DLQ Lambda time out: 5 minutes + 1 minute
			});

			// Set DLQ QueueURL as Env value
			environment.DLQ_SQS_URL = dlq.queueUrl;

			// Reprocess Lambda for DLQ
			const reprocessLambda = this.createLambdaFunction(notificationType, resolvedDlqHandler, environment, role, runtime, code, randomSuffix, true);

			// Add policy to consume DLQ
			reprocessLambda.addToRolePolicy(new iam.PolicyStatement({
				actions: [
					'sqs:DeleteMessage',
					'sqs:GetQueueAttributes',
					'sqs:ReceiveMessage'
				],
				resources: [dlq.queueArn],
			}));

			const queue = new sqs.Queue(this, `SP-API-Queue-${notificationType}`, {
				queueName: `sp-api-sqs-queue-${notificationType}-${randomSuffix}`,
				visibilityTimeout: Duration.seconds(65),
				deadLetterQueue: {
					queue: dlq,
					maxReceiveCount: 3,
				},
			});

			new lambda.EventSourceMapping(this, `SP-API-ESM-${notificationType}`, {
				eventSourceArn: queue.queueArn,
				target: lambdaFunction,
				batchSize: 10,
				enabled: true,
				reportBatchItemFailures: true,
			});

			queue.addToResourcePolicy(new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				principals: [new iam.AccountPrincipal('437568002678')],
				actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes'],
				resources: [queue.queueArn],
			}));

			return {
				notificationType,
				resource: queue.queueArn,
			};
		} else if (eventBus) {

			// Common Partner source EventBus
			const resolvedSource = eventBusArn
				? cdk.Fn.select(1, cdk.Fn.split('event-bus/', eventBusArn))
				: 'aws.partner/sellingpartnerapi.amazon.com';

			// DLQ for EventBridge target
			const eventBridgeDLQ = new sqs.Queue(this, `SP-API-EventBridge-DLQ-${notificationType}`, {
				queueName: `sp-api-eventbridge-dead-letter-queue-${notificationType}-${randomSuffix}`,
				visibilityTimeout: Duration.minutes(6) // To be aligned with DLQ Lambda time out: 5 minutes + 1 minute
			});

			// Set DLQ QueueURL as Env value
			environment.DLQ_SQS_URL = eventBridgeDLQ.queueUrl;

			// Reprocess Lambda for DLQ
			const reprocessLambda = this.createLambdaFunction(notificationType, resolvedDlqHandler, environment, role, runtime, code, randomSuffix, true);

			// Add policy to consume DLQ
			reprocessLambda.addToRolePolicy(new iam.PolicyStatement({
				actions: [
					'sqs:DeleteMessage',
					'sqs:GetQueueAttributes',
					'sqs:ReceiveMessage'
				],
				resources: [eventBridgeDLQ.queueArn],
			}));

			// Event rule
			const rule = new events.Rule(this, `SP-API-Rule-${notificationType}`, {
				ruleName: `Rule-${notificationType}-${randomSuffix}`,
				description: `Rule for ${notificationType}`,
				eventBus: eventBus,
				eventPattern: {
					source: [resolvedSource],
					detailType: [notificationType],
				},
				targets: [
					new targets.LambdaFunction(lambdaFunction, {
						retryAttempts: 3, // retry 3 times
						deadLetterQueue: eventBridgeDLQ,
					}),
				],
			});

			// Lambda Invoke permission
			lambdaFunction.addPermission(`SP-API-InvokePermission-${notificationType}`, {
				action: 'lambda:InvokeFunction',
				principal: new iam.ServicePrincipal('events.amazonaws.com'),
				sourceArn: rule.ruleArn,
			});

			const stack = cdk.Stack.of(this);
			const metadata = {
				accountId: stack.account,
				region: stack.region,
			};

			return {
				notificationType,
				resource: JSON.stringify(metadata),
			};
		}

		throw new Error('Invalid configuration: useSQS is false and eventBus is undefined.');
	}

	private buildEnvironment(webHook: any, crossPlatform: any, internal: any, clientTableName: string, notificationType?: string): { [key: string]: string } {
		const env: { [key: string]: string } = {
			CLIENT_TABLE_NAME: clientTableName || '',
		};

		if (webHook) {
			env.WEB_HOOK_URL = webHook.Url;
			if (webHook.Auth) {
				env.WEB_HOOK_AUTH_TOKEN = webHook.Auth.Value;
				env.WEB_HOOK_AUTH_HEADER_NAME = webHook.Auth.HeaderName;
			}
		}

		if (crossPlatform) {
			env.CROSS_PLATFORM_DESTINATION_TYPE = crossPlatform.DestinationType;
			env.NOTIFICATION_TYPE = notificationType || '';

			if (crossPlatform.DestinationType === 'AWS_SQS') {
				env.TARGET_SQS_URL = crossPlatform.TargetSqsUrl;
			} else if (crossPlatform.DestinationType === 'AWS_EVENTBRIDGE') {
				env.TARGET_EVENT_BUS_ARN = crossPlatform.TargetEventBusArn;
			} else if (crossPlatform.DestinationType === 'GCP_PUBSUB') {
				env.GCP_PROJECT_ID = crossPlatform.GcpProjectId;
				env.GCP_TOPIC_ID = crossPlatform.GcpTopicId;
				env.GCP_SPAPI_PUBSUB_KEY_ARN = crossPlatform.GcpPubsubKeyArn;
			} else if (crossPlatform.DestinationType === 'AZURE_STORAGE_QUEUE') {
				env.AZURE_QUEUE_CONNECTION_STRING_ARN = crossPlatform.AzureQueueConnectionStringArn;
				env.AZURE_QUEUE_NAME = crossPlatform.AzureQueueName;
			} else if (crossPlatform.DestinationType === 'AZURE_SERVICE_BUS') {
				env.AZURE_SB_CONNECTION_STRING_ARN = crossPlatform.AzureSbConnectionStringArn;
				env.AZURE_SB_QUEUE_NAME = crossPlatform.AzureSbQueueName;
			}
		}

		return env;
	}

	private resolveHandler(webHook: any, crossPlatform: any, internal: any, fallbackHandler: string): string {
		return webHook?.Lambda
			|| crossPlatform?.Lambda
			|| internal?.Lambda
			|| fallbackHandler;
	}

	private resolveDlqHandler(webHook: any, crossPlatform: any, internal: any, fallbackHandler: string): string {
		return webHook?.DlqLambda
			|| crossPlatform?.DlqLambda
			|| internal?.DlqLambda
			|| fallbackHandler;
	}

	private buildStateMachineForInternalIfNeeded(
		role: iam.Role,
		internal: any,
		environment: { [key: string]: string },
		runtime: lambda.Runtime,
		code: lambda.Code,
		randomSuffix: string,
		notificationType: string,
		artifactsS3BucketName: cdk.CfnParameter,
		tableArn: string
	): Record<string, stepfunctions.CfnStateMachine> | undefined {
		if (!internal || !internal.StepFunctions) return;

		const stateMachines: Record<string, stepfunctions.CfnStateMachine> = {};

		const stepFunctions = internal.StepFunctions as { [key: string]: { Lambdas: string[]; Definitions: string } };

		function shorten(input: string, maxLen: number): string {
			const clean = input.replace(/[^a-zA-Z0-9]/g, '');
			return clean.length > maxLen ? clean.slice(0, maxLen) : clean;
		}

		for (const [workflowName, config] of Object.entries(stepFunctions)) {
			if (!config || !config.Lambdas || !config.Definitions) {
				throw new Error(`Invalid StepFunction config for ${workflowName}`);
			}

			// IAM Role for StepFunction execution
			const stateMachineRole = new iam.Role(this, `SPAPI-${notificationType}-${workflowName}-StepFunctionExecutionRole`, {
				assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
			});

			const stepFnLambdaRole = this.createProcessNotificationsLambdaRole(
				randomSuffix,
				tableArn,
				`SPAPI-${notificationType}-${workflowName}-StepFnLambdaRole`
			);

			const substitutions: { [key: string]: string } = {};

			config.Lambdas.forEach((handlerFqn: string, index: number) => {
				const segments = handlerFqn.split('.');
				const className = segments[segments.length - 1];
				const logicalId = `SPAPI-${notificationType}-${workflowName}-${className}`;
				const shortNotificationType = shorten(notificationType, 10); // e.g., ORDER_CHANGE → ORDERCHANG
				const shortWorkflow = shorten(workflowName, 10);             // e.g., OrderNotification → OrderNotif
				const shortClass = shorten(className, 15);                   // e.g., SendNotificationHandler → SendNotifHand
				const functionName = `SPAPI-${shortNotificationType}-${shortWorkflow}-${shortClass}-${randomSuffix}`.slice(0, 64);

				const fn = new lambda.Function(this, logicalId, {
					functionName,
					description: `Lambda handler for ${handlerFqn}`,
					code,
					handler: handlerFqn,
					runtime,
					memorySize: 512,
					timeout: Duration.seconds(60),
					environment,
					role: stepFnLambdaRole,
				});

				stateMachineRole.addToPolicy(new iam.PolicyStatement({
					actions: ['lambda:InvokeFunction'],
					resources: [fn.functionArn],
				}));

				const substitutionKey = `Step${index + 1}Arn`;
				substitutions[substitutionKey] = fn.functionArn;
			});

			const stepFn = new stepfunctions.CfnStateMachine(this, `SPAPIStateMachine-${notificationType}-${workflowName}`, {
				stateMachineName: `SPAPIStateMachine-${notificationType}-${workflowName}-${randomSuffix}`,
				stateMachineType: 'STANDARD',
				roleArn: stateMachineRole.roleArn,
				definitionS3Location: {
					bucket: artifactsS3BucketName.valueAsString,
					key: config.Definitions,
				},
				definitionSubstitutions: {
					...substitutions,
					Timestamp: new Date().toISOString()
				},
			});

			role.addToPolicy(new iam.PolicyStatement({
				actions: ['states:StartExecution'],
				resources: [stepFn.attrArn],
			}));

			stateMachines[workflowName] = stepFn;
		}

		return stateMachines;
	}



	private addRolePoliciesForCrossPlatformIfNeeded(role: iam.Role, crossPlatform: any): void {
		if (!crossPlatform) return;

		if (crossPlatform.DestinationType === 'AWS_SQS') {
			role.addToPolicy(new iam.PolicyStatement({
				actions: ['sqs:SendMessage'],
				resources: [crossPlatform.TargetSqsArn],
			}));
		} else if (crossPlatform.DestinationType === 'AWS_EVENTBRIDGE') {
			role.addToPolicy(new iam.PolicyStatement({
				actions: ['events:PutEvents'],
				resources: [crossPlatform.TargetEventBusArn],
			}));
		} else if (crossPlatform.DestinationType === 'GCP_PUBSUB') {
			role.addToPolicy(new iam.PolicyStatement({
				actions: ['secretsmanager:GetSecretValue'],
				resources: [crossPlatform.GcpPubsubKeyArn],
			}));
		} else if (crossPlatform.DestinationType === 'AZURE_STORAGE_QUEUE') {
			role.addToPolicy(new iam.PolicyStatement({
				actions: ['secretsmanager:GetSecretValue'],
				resources: [crossPlatform.AzureQueueConnectionStringArn],
			}));
		} else if (crossPlatform.DestinationType === 'AZURE_SERVICE_BUS') {
			role.addToPolicy(new iam.PolicyStatement({
				actions: ['secretsmanager:GetSecretValue'],
				resources: [crossPlatform.AzureSbConnectionStringArn],
			}));
		}
	}

	private createProcessNotificationsLambdaRole(roleNameSuffix: string, tableArn: string, idPrefix: string): iam.Role {
		const role = new iam.Role(this, `${idPrefix}`, {
			roleName: `${idPrefix}-${roleNameSuffix}`,
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
			],
		});

		// SQS Read policy
		role.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ['sqs:DeleteMessage', 'sqs:GetQueueAttributes', 'sqs:ReceiveMessage'],
			resources: [`arn:${this.partition}:sqs:${this.region}:${this.account}:sp-api-sqs-queue-*`],
		}));

		// SecretsManager Read policy
		role.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ['secretsmanager:GetSecretValue'],
			resources: [
				`arn:${this.partition}:secretsmanager:${this.region}:${this.account}:secret:SPAPIAppCredentials-*`,
				`arn:${this.partition}:secretsmanager:${this.region}:${this.account}:secret:SPAPISecretArn-*`,
			],
		}));

		// DynamoDB Read policy
		role.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: ['dynamodb:GetItem'],
			resources: [tableArn],
		}));

		return role;
	}


	private createLambdaFunction(
		notificationType: string,
		handler: string,
		environment: { [key: string]: string },
		role: iam.Role,
		runtime: lambda.Runtime,
		code: lambda.Code,
		randomSuffix: string,
		isDlqLambda: boolean,
	): lambda.Function {
		return new lambda.Function(this, isDlqLambda? `SPAPI-ReprocessLambda-${notificationType}`: `SPAPI-Lambda-${notificationType}`, {
			functionName: isDlqLambda? `SPAPIReprocessLambda-${notificationType}-${randomSuffix}`: `SP-APILambda-${notificationType}-${randomSuffix}`,
			description: isDlqLambda? `Lambda to reprocess messages from DLQ for ${notificationType}`: `SP-API Lambda for ${notificationType}`,
			code,
			handler,
			runtime,
			memorySize: 512,
			timeout: isDlqLambda? Duration.minutes(5): Duration.seconds(60),
			environment,
			role
		});
	}
}
