import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import * as path from 'path';
import * as fs from 'fs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as events from 'aws-cdk-lib/aws-events';  // Add this line
import * as targets from 'aws-cdk-lib/aws-events-targets';  // Add this line


export class SpApiOauthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Prepare frontend files
    this.prepareFrontendFiles();


    // Frontend hosting
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create CloudFront distribution with caching disabled
    const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
    });

    // DynamoDB table for storing token history
    const tokenHistoryTable = new dynamodb.Table(this, 'TokenHistoryTable', {
      partitionKey: { name: 'partnerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Add GSI for querying by oldToken or newToken if needed
    tokenHistoryTable.addGlobalSecondaryIndex({
      indexName: 'tokenIndex',
      partitionKey: { name: 'oldToken', type: dynamodb.AttributeType.STRING },
    });

    // DynamoDB table for storing partners (sellers/vendors)
    const partnersTable = new dynamodb.Table(this, 'PartnersTable', {
      partitionKey: { name: 'partnerId', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Add GSI for querying by amazonId
    partnersTable.addGlobalSecondaryIndex({
      indexName: 'amazonIdIndex',
      partitionKey: { name: 'amazonId', type: dynamodb.AttributeType.STRING },
    });

    partnersTable.addGlobalSecondaryIndex({
      indexName: 'clientIdIndex',
      partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
    });

    // DynamoDB table for storing OAuth states
    const stateTable = new dynamodb.Table(this, 'OAuthStateTable', {
      partitionKey: { name: 'state', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });


    // Update DynamoDB table to include GSI for clientId


    // Secrets for SP-API developer account credentials
    const spApiSecrets = new secretsmanager.Secret(this, 'SpApiSecrets', {
      secretObjectValue: {
        clientId: cdk.SecretValue.unsafePlainText('YOUR_CLIENT_ID'),
        applicationId: cdk.SecretValue.unsafePlainText('YOUR_APPLICATION_ID'),
        clientSecret: cdk.SecretValue.unsafePlainText('YOUR_CLIENT_SECRET'),
      },
      description: 'Amazon SP-API developer account credentials',
    });

    // First, create the KMS key with the required policy
    const kmsKey = new kms.Key(this, 'SpApiNotificationsKey', {
      enableKeyRotation: true,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountPrincipal('437568002678')], // SP-API AWS account
            actions: [
              'kms:GenerateDataKey',
              'kms:Decrypt'
            ],
            resources: ['*']
          }),
          // Add default admin policy for your account
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*']
          })
        ]
      })
    });
    // Create SQS Queue for new client secret notifications
    // Then update your SQS queue to use this key
    const clientSecretQueue = new sqs.Queue(this, 'ClientSecretQueue', {
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: kmsKey,
      retentionPeriod: cdk.Duration.days(14),
      visibilityTimeout: cdk.Duration.seconds(30)
    });



    // Your existing SQS policy remains the same
    const sqsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AccountPrincipal('437568002678')],
      actions: [
        'sqs:SendMessage',
        'sqs:GetQueueAttributes'
      ],
      resources: [clientSecretQueue.queueArn]
    });


    // Add policy to queue
    clientSecretQueue.addToResourcePolicy(sqsPolicy);

    // Lambda function
    const oauthFunction = new lambda.Function(this, 'SpApiOAuthFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        PARTNERS_TABLE: partnersTable.tableName,
        STATE_TABLE_NAME: stateTable.tableName,
        TOKENS_HISTORY_TABLE: tokenHistoryTable.tableName,
        SECRETS_ARN: spApiSecrets.secretArn,
        WEBAPP_DOMAIN: distribution.distributionDomainName,

        // Add both URL and ARN for the queue
        CLIENT_SECRET_QUEUE_URL: clientSecretQueue.queueUrl,
        CLIENT_SECRET_QUEUE_ARN: clientSecretQueue.queueArn,

        // OAuth endpoints
        TOKEN_ENDPOINT: 'https://api.integ.amazon.com/auth/O2/token',//'https://api.amazon.com/auth/o2/token',
        // Region-specific SP-API endpoints
        SPAPI_ENDPOINT_NA: 'https://marketplaceapi-beta.amazonservices.com', //'https://sellingpartnerapi-na.amazon.com',
        SPAPI_ENDPOINT_EU: 'https://sellingpartnerapi-eu.amazon.com',
        SPAPI_ENDPOINT_FE: 'https://sellingpartnerapi-fe.amazon.com',
        // Region-specific AWS regions
        AWS_REGION_NA: 'us-east-1',
        AWS_REGION_EU: 'eu-west-1',
        AWS_REGION_FE: 'us-west-2',
        // Authorization endpoints
        SELLER_AUTHORIZE_ENDPOINT: 'https://rainier-m1k.integ.amazon.com/apps/authorize/consent',//'https://sellercentral.amazon.com/apps/authorize/consent',
        VENDOR_AUTHORIZE_ENDPOINT: 'https://vendorcentral.amazon.com/apps/authorize/consent',
        // API Gateway stage
        API_STAGE: 'api'
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // Grant Lambda permissions
    partnersTable.grantReadWriteData(oauthFunction);
    stateTable.grantReadWriteData(oauthFunction);
    spApiSecrets.grantRead(oauthFunction);
    spApiSecrets.grantWrite(oauthFunction);
    tokenHistoryTable.grantReadWriteData(oauthFunction);




    // Update Lambda environment variables
    oauthFunction.addEnvironment('CLIENT_SECRET_QUEUE_URL', clientSecretQueue.queueUrl);

    // Grant Lambda permission to receive and delete messages
    clientSecretQueue.grantConsumeMessages(oauthFunction);

    // Add EventSource mapping to trigger Lambda on SQS messages
    new lambda.EventSourceMapping(this, 'SqsEventSource', {
      target: oauthFunction,
      eventSourceArn: clientSecretQueue.queueArn,
      batchSize: 1 // Process one message at a time
    });

    const reminderFunction = new lambda.Function(this, 'SpApiReminderFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'reminderHandler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        PARTNERS_TABLE: partnersTable.tableName,
        SECRETS_ARN: spApiSecrets.secretArn,
        REMINDER_INTERVAL_DAYS: '7' // Send reminders weekly
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
    });

    // Grant permissions
    partnersTable.grantReadWriteData(reminderFunction);
    spApiSecrets.grantRead(reminderFunction);

    // Create a rule to trigger the reminder function daily
    new events.Rule(this, 'DailyReminderRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }), // Run at midnight UTC
      targets: [new targets.LambdaFunction(reminderFunction)]
    });

    // For each Lambda integration, update the integration settings
    // For each Lambda integration, update the integration settings
    const defaultIntegrationOptions: apigateway.LambdaIntegrationOptions = {
      // Add response headers to handle CORS and redirects
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'"
          }
        },
        {
          // Handle redirects
          statusCode: '302',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'",
            'method.response.header.Location': 'integration.response.body.redirectUrl'
          },
          // Match redirect responses
          selectionPattern: '.*"statusCode":302.*'
        },
        {
          // Handle errors
          statusCode: '400',
          selectionPattern: '.*Error.*',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Credentials': "'true'"
          }
        }
      ]
    };

    // Update method options to match integration responses
    const methodOptions: apigateway.MethodOptions = {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true
          }
        },
        {
          statusCode: '302',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true,
            'method.response.header.Location': true
          }
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Credentials': true
          }
        }
      ]
    };

    /// API Gateway
    // Update the API Gateway CORS configuration
    const api = new apigateway.RestApi(this, 'SpApiOAuthApi', {
      restApiName: 'SP-API OAuth Service',
      description: 'Service for handling Amazon SP-API OAuth workflow',
      deployOptions: {
        stageName: 'api',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent'
        ],
        maxAge: cdk.Duration.days(1),
        allowCredentials: true,
        exposeHeaders: [
          'Access-Control-Allow-Origin',
          'Access-Control-Allow-Credentials',
          'Location'
        ]
      }
    });


    // Partners root resource
    const partners = api.root.addResource('partners');

    // Partner collection endpoints
    partners.addMethod('POST', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions); // Create partner
    partners.addMethod('GET', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);  // List partners

    // OAuth callback endpoint (fixed URL)
    const oauth = partners.addResource('oauth');
    const callback = oauth.addResource('callback');
    callback.addMethod('GET', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

    // Partner-specific endpoints
    const partner = partners.addResource('{partnerId}');
    partner.addMethod('GET', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);    // Get partner details
    partner.addMethod('PUT', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);    // Update partner details
    partner.addMethod('DELETE', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions); // Delete partner

    // Partner-specific OAuth endpoints
    const partnerOauth = partner.addResource('oauth');
  
    // OAuth initialization endpoint
    const init = partnerOauth.addResource('init');
    init.addMethod('POST', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

    // OAuth token refresh endpoint
    const refresh = partnerOauth.addResource('refresh');
    refresh.addMethod('POST', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);



    // Appstore endpoints that don't require partnerId
    const appstore = partners.addResource('appstore');

    // Initialize appstore authorization (no partnerId needed)
    const authorize = appstore.addResource('authorize');
    authorize.addMethod('GET', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

    // Appstore callback endpoint (fixed URL)
    const appstoreCallback = appstore.addResource('callback');
    appstoreCallback.addMethod('GET', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

    // Partner-specific appstore endpoints
    const partnerAppstore = partner.addResource('appstore');

    // Status endpoint (requires partnerId)
    const status = partnerAppstore.addResource('status');
    status.addMethod('GET', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

    // Add this section to SpApiOauthStack.ts, inside the constructor after existing endpoints

    // Auth test endpoints
    const authTest = partner.addResource('test');

    // Test seller authorization
    const testSeller = authTest.addResource('seller');
    testSeller.addMethod('POST', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

    // Test vendor authorization
    const testVendor = authTest.addResource('vendor');
    testVendor.addMethod('POST', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

    // In SpApiOauthStack.ts, add this with other API endpoints
    const appConfig = api.root.addResource('config');
    appConfig.addMethod('GET', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

    // Partner-specific notifications endpoints
    const notifications = partner.addResource('notifications');
    const setup = notifications.addResource('setup');
    setup.addMethod('POST', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

 
    const tokensResource = partner.addResource('tokens');
    const rdtResource = tokensResource.addResource('rdt');

    // Add the POST method with CORS headers
    rdtResource.addMethod('POST', 
      new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), 
      methodOptions
    );


    // Add credential rotation endpoint
    const credentials = partner.addResource('credentials');
    const rotate = credentials.addResource('rotate');
    rotate.addMethod('POST',
      new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions),
      methodOptions
    );

    const partnerStatus = partner.addResource('status');
    partnerStatus.addMethod('PUT', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);

    const credentialsResource = api.root.addResource('credentials');
    const updateResource = credentialsResource.addResource('update');

    
    // 4. Add the POST method
    updateResource.addMethod('POST', new apigateway.LambdaIntegration(oauthFunction, defaultIntegrationOptions), methodOptions);



    // Deploy website files
    new s3deploy.BucketDeployment(this, 'WebsiteDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../frontend'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });


    // Stack outputs
    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Website URL',
    });

    // Stack outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 bucket name for website hosting'
    });

    // Output queue URL and ARN for reference
    new cdk.CfnOutput(this, 'ClientSecretQueueUrl', {
      value: clientSecretQueue.queueUrl,
      description: 'URL of SQS queue for client secret notifications'
    });

    new cdk.CfnOutput(this, 'ClientSecretQueueArn', {
      value: clientSecretQueue.queueArn,
      description: 'ARN of SQS queue for client secret notifications'
    });

    // Add output for token history table name
    new cdk.CfnOutput(this, 'TokenHistoryTableName', {
      value: tokenHistoryTable.tableName,
      description: 'Name of DynamoDB table for token history'
    });
  }

  private prepareFrontendFiles() {
    const frontendDir = path.join(__dirname, '../frontend');
    const templatePath = path.join(frontendDir, 'index.html.template');
    const outputPath = path.join(frontendDir, 'index.html');

    // Ensure frontend directory exists
    if (!fs.existsSync(frontendDir)) {
      fs.mkdirSync(frontendDir, { recursive: true });
    }

    // Copy template file if it doesn't exist
    if (!fs.existsSync(templatePath)) {
      fs.copyFileSync(path.join(__dirname, '../templates/index.html'), templatePath);
    }

    // Read template and replace API endpoint placeholder
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    // Note: We're keeping the placeholder here as it will be replaced during deployment
    fs.writeFileSync(outputPath, htmlContent);
  }
}
