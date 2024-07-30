import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import {DefaultStackSynthesizer} from "aws-cdk-lib";

export interface SpApiAppCdkStackProps extends cdk.StackProps {
  readonly randomSuffix: string;
  readonly spApiCdkQualifier: string;
}

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
      description: "Client secret of the SP-API app"
    });

    const refreshToken = new cdk.CfnParameter(this, 'refreshToken', {
      type: 'String',
      noEcho: true,
      description: "Refresh token of the SP-API app"
    });

    const emailId = new cdk.CfnParameter(this, 'emailId', {
      type: 'String',
      noEcho: true,
      description: "Email address to receive notifications"
    });

    const schedule = new cdk.CfnParameter(this, 'schedule', {
      type: 'String',
      description: "EventBridge schedule"
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

    const lambdaFunctionHandler = new cdk.CfnParameter(this, 'lambdaFunctionHandler', {
      type: 'String',
      description: "Handler of Lambda Function"
    });

    // Resources
    const clientErrorSnsTopic = new sns.CfnTopic(this, '4xxSNSTopic', {
      displayName: '4xx Error SNS Topic',
      topicName: [
        '4xxErrorSNSTopic',
        props.randomSuffix!,
      ].join('-'),
    });

    const spApiAppCredentials = new secretsmanager.CfnSecret(this, 'SPAPIAppCredentials', {
      name: [
        'SPAPIAppCredentials',
        props.randomSuffix!,
      ].join('-'),
      description: 'Secret containing SP-API app credentials',
      secretString: `{"AppClientId": "${clientId.valueAsString!}", "AppClientSecret": "${clientSecret.valueAsString!}"}`,
    });

    new cloudwatch.CfnAlarm(this, '400Alarm', {
      alarmDescription: '400 Error alarm',
      alarmActions: [
        clientErrorSnsTopic.ref,
      ],
      metricName: [
        '400 Error',
        props.randomSuffix!,
      ].join('-'),
      namespace: 'SP-API/4xxErrors',
      statistic: 'Sum',
      period: 300,
      evaluationPeriods: 1,
      threshold: 5,
      comparisonOperator: 'GreaterThanThreshold',
    });

    new cloudwatch.CfnAlarm(this, '403Alarm', {
      alarmDescription: '403 Error alarm',
      alarmActions: [
        clientErrorSnsTopic.ref,
      ],
      metricName: [
        '403 Error',
        props.randomSuffix!,
      ].join('-'),
      namespace: 'SP-API/4xxErrors',
      statistic: 'Sum',
      period: 300,
      evaluationPeriods: 1,
      threshold: 5,
      comparisonOperator: 'GreaterThanThreshold',
    });

    new cloudwatch.CfnAlarm(this, '404Alarm', {
      alarmDescription: '404 Error alarm',
      alarmActions: [
        clientErrorSnsTopic.ref,
      ],
      metricName: [
        '404 Error',
        props.randomSuffix!,
      ].join('-'),
      namespace: 'SP-API/4xxErrors',
      statistic: 'Sum',
      period: 300,
      evaluationPeriods: 1,
      threshold: 5,
      comparisonOperator: 'GreaterThanThreshold',
    });

    new cloudwatch.CfnAlarm(this, '429Alarm', {
      alarmDescription: '429 Error alarm',
      alarmActions: [
        clientErrorSnsTopic.ref,
      ],
      metricName: [
        '429 Error',
        props.randomSuffix!,
      ].join('-'),
      namespace: 'SP-API/4xxErrors',
      statistic: 'Sum',
      period: 300,
      evaluationPeriods: 1,
      threshold: 5,
      comparisonOperator: 'GreaterThanThreshold',
    });

    const errorMonitoringLambdaExecutionRole = new iam.CfnRole(this, 'ErrorMonitoringLambdaExecutionRole', {
      roleName: [
        'ErrorMonitoringLambdaExecutionRole',
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
      ],
    });

    new sns.CfnSubscription(this, 'ErrorMonitoringSubscription', {
      protocol: 'email',
      topicArn: clientErrorSnsTopic.ref,
      endpoint: emailId.valueAsString!,
    });

    const errorMonitoringLambdaFunction = new lambda.CfnFunction(this, 'ErrorMonitoringLambdaFunction', {
      functionName: [
        'ErrorMonitoringLambdaFunction',
        props.randomSuffix!,
      ].join('-'),
      description: 'Error Monitoring Lambda function',
      code: {
        s3Bucket: artifactsS3BucketName.valueAsString!,
        s3Key: lambdaFunctionsCodeS3Key.valueAsString!,
      },
      handler: lambdaFunctionHandler.valueAsString!,
      role: errorMonitoringLambdaExecutionRole.attrArn,
      runtime: programmingLanguage.valueAsString!,
      memorySize: 512,
      timeout: 60,
      environment: {
        variables: {
          'SP_API_APP_CREDENTIALS_SECRET_ARN': spApiAppCredentials.ref,
          'REFRESH_TOKEN': refreshToken.valueAsString!,
        },
      },
    });

    const errorMonitoringScheduleRole = new iam.CfnRole(this, 'ErrorMonitoringScheduleRole', {
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
            Action: [
              'sts:AssumeRole',
            ],
          },
        ],
      },
      policies: [
        {
          policyName: 'ErrorMonitoringScheduleRolePolicy',
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'lambda:InvokeFunction',
                ],
                Resource: [
                  errorMonitoringLambdaFunction.attrArn,
                ],
              },
            ],
          },
        },
      ],
    });

    const lambdaLogGroup = new logs.CfnLogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/${errorMonitoringLambdaFunction.ref}`,
    });

    const badRequestMetricFilter = new logs.CfnMetricFilter(this, '400MetricFilter', {
      filterName: [
        '400 Error',
        props.randomSuffix!,
      ].join('-'),
      filterPattern: '400',
      logGroupName: `/aws/lambda/${errorMonitoringLambdaFunction.ref}`,
      metricTransformations: [
        {
          metricValue: '1',
          metricNamespace: 'SP-API/4xxErrors',
          metricName: [
            '400 Error',
            props.randomSuffix!,
          ].join('-'),
        },
      ],
    });
    badRequestMetricFilter.addDependency(lambdaLogGroup);

    const forbiddenMetricFilter = new logs.CfnMetricFilter(this, '403MetricFilter', {
      filterName: [
        '403 Error',
        props.randomSuffix!,
      ].join('-'),
      filterPattern: '403',
      logGroupName: `/aws/lambda/${errorMonitoringLambdaFunction.ref}`,
      metricTransformations: [
        {
          metricValue: '1',
          metricNamespace: 'SP-API/4xxErrors',
          metricName: [
            '403 Error',
            props.randomSuffix!,
          ].join('-'),
        },
      ],
    });
    forbiddenMetricFilter.addDependency(lambdaLogGroup);

    const notFoundMetricFilter = new logs.CfnMetricFilter(this, '404MetricFilter', {
      filterName: [
        '404 Error',
        props.randomSuffix!,
      ].join('-'),
      filterPattern: '404',
      logGroupName: `/aws/lambda/${errorMonitoringLambdaFunction.ref}`,
      metricTransformations: [
        {
          metricValue: '1',
          metricNamespace: 'SP-API/4xxErrors',
          metricName: [
            '404 Error',
            props.randomSuffix!,
          ].join('-'),
        },
      ],
    });
    notFoundMetricFilter.addDependency(lambdaLogGroup);

    const tooManyRequestsMetricFilter = new logs.CfnMetricFilter(this, '429MetricFilter', {
      filterName: [
        '429 Error',
        props.randomSuffix!,
      ].join('-'),
      filterPattern: '429',
      logGroupName: `/aws/lambda/${errorMonitoringLambdaFunction.ref}`,
      metricTransformations: [
        {
          metricValue: '1',
          metricNamespace: 'SP-API/4xxErrors',
          metricName: [
            '429 Error',
            props.randomSuffix!,
          ].join('-'),
        },
      ],
    });
    tooManyRequestsMetricFilter.addDependency(lambdaLogGroup);

    new scheduler.CfnSchedule(this, 'ErrorMonitoringSchedule', {
      name: [
        'ErrorMonitoringSchedule',
        props.randomSuffix!,
      ].join('-'),
      scheduleExpression: schedule.valueAsString!,
      flexibleTimeWindow: {
        mode: 'OFF',
      },
      target: {
        arn: errorMonitoringLambdaFunction.attrArn,
        roleArn: errorMonitoringScheduleRole.attrArn,
      },
    });
  }
}
