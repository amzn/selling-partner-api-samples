## Overview
This Sample Solution provides all required resources to deploy to the AWS cloud a fully functional SP-API application that implements the SP-API Error Monitoring use case end-to-end.
Use this application to test the proposed solution, do changes and/or integrate it to your own product.

## Solution
This sample solution implements an error monitoring and alerting workflow. API error response codes are captured from the logs and
alert is sent when the volume of errors hits a specific threshold.

This solution consists of the following components,
1. A [Lambda](https://aws.amazon.com/lambda/) function which includes code to execute SP-API calls that return 4xx errors.
2. [EventBridge](https://aws.amazon.com/eventbridge/) Scheduler to trigger the Lambda function based on the defined schedule in app config to generate logs that will have 4xx errors.
3. [CloudWatch](https://aws.amazon.com/cloudwatch/) Metric Filters to identify the 4xx errors from the CloudWatch logs of Lambda execution.
4. [CloudWatch](https://aws.amazon.com/cloudwatch/) Metrics to monitor the sum of occurrences of 4xx errors.
5. [CloudWatch](https://aws.amazon.com/cloudwatch/) Alarm to send notification to the email id mentioned in the config file when the errors cross the threshold.
6. [Simple notification service](https://aws.amazon.com/sns/) to send email alerts to users

## Workflow
Lambda function includes sample code to execute SP-API calls that return 4xx errors and the event scheduler triggers the lambda
function every few minutes as defined in the config. Cloudwatch metric filters created will filter the errors from the logs and trigger alerts
when the volume of errors exceeds a defined threshold.

## Pre-requisites
The pre-requisites for deploying the Sample Solution App to the AWS cloud are:
* [Registering as a developer for SP-API](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer), and [registering an SP-API application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
* An [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with permissions to create a new user, a policy, and attach it to the user
    * If you don't have one, you can create it following the steps  under **Usage - 2. Configure Sample Solution App's IAM user**
* The [AWS CLI](https://aws.amazon.com/cli/)
    * If not present, it will be installed as part of the deployment script
* [Maven](https://maven.apache.org/)
    * Just for deploying a Java-based application
    * If not present, it will be installed as part of the deployment script
* [GitBash](https://git-scm.com/download/win)
    * in case you use Windows in order to run the deployment script.

## Usage
### 1. Update config file
To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your SP-API application.
1. Open [app.config](app/app.config) file and replace all occurrences of `<dev_value>` following the instructions below:
2. Update `ClientId` and `ClientSecret` attribute values with [Client Id and Client Secret of the SP-API application](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials) respectively
3. Update `RefreshToken` attribute value with the refresh token of the selling partner you will be using for testing
3. Update `EmailId` attribute with the email address you would like to receive email notifications on
4. Update `Schedule` attribute to the event bridge schedule that you would like to use. Sample value for testing `rate(1 minute)`


>Note: While updating the config file, don't leave blank spaces before and after `=`, and don't use quotation marks

#### Sample config file:
```
ClientId=amzn1.application-oa2-client.abc123def456xyz789
ClientSecret=amzn1.oa2-cs.v1.abc123def456xyz789
RefreshToken=Atzr|IQEBLzAtAhexamplewVz2Nn6f2y-tpJX2DeX...
EmailId=user@domain.com
Schedule=rate(1 minute)
```

### 2. Configure Sample Solution App's IAM user
#### I. Create IAM policy
In order to execute the deployment script, an IAM user with the appropriate permissions is needed.
To create a new IAM policy with the required permissions, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Policies console](https://us-east-1.console.aws.amazon.com/iamv2/home#/policies)
3. Click **Create policy**
4. Next to **Policy editor**, select **JSON** and replace the default policy with the JSON below
```
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "SPAPIAppIAMPolicy",
			"Effect": "Allow",
			"Action": [
				"iam:CreateUser",
				"iam:DeleteUser",
				"iam:CreatePolicy",
				"iam:DeletePolicy",
				"iam:AttachUserPolicy",
				"iam:DetachUserPolicy",
				"iam:CreateAccessKey",
				"iam:DeleteAccessKey"
			],
			"Resource": [
				"arn:aws:iam::610134619817:user/*",
				"arn:aws:iam::610134619817:policy/*"
			]
		}
	]
}
```
5. Click **Next**
6. Select a name for your policy. Take note of this value as you will need it in the next section.
7. Review the changes and click **Create policy**
#### II. Create IAM user
To create a new IAM user with the required permissions, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home#/users)
3. Click **Create user**
4. Select a name for your user
5. In the **Set permissions** page, select **Attach policies directly**
6. In the **Permissions policies**, search for the policy created in **I. Create IAM policy** section. Select the policy, and click **Next**
7. Review the changes and click **Create user**

#### III. Retrieve IAM user credentials
Security credentials for the IAM user will be requested during the deployment script execution.
To create a new access key pair, follow the steps below. If you already have valid access key and secret access key, you can skip this section.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home#/users)
3. Select the IAM user created in II. Create IAM user
4. Go to **Security credentials** tab
5. Under **Access keys**, click **Create access key**
6. In **Access key best practices & alternatives** page, select **Command Line Interface (CLI)**
7. Acknowledge the recommendations, and click **Next**
8. Click **Create access key**
9. Copy `Access key` and `Secret access key`. This is the only time that these keys can be viewed or downloaded, and you will need them while executing the deployment script
10. Click **Done**

### 3. Execute the deployment script
The deployment script will create a Sample Solution App in the AWS cloud.
To execute the deployment script, follow the steps below.
1. Identify the deployment script for the programming language you want for your Sample Solution App.
    1. For example, for the Java application the file is [app/scripts/java/java-app.sh](app/scripts/java/java-app.sh)
2. Execute the script from your terminal or Git Bash
    1. For example, to execute the Java deployment script in a Unix-based system or using Git Bash, run `bash java-app.sh`
3. Wait for the CloudFormation stack creation to finish
    1. Navigate to [CloudFormation console](https://console.aws.amazon.com/cloudformation/home)
    2. Wait for the stack named **sp-api-app-\<language\>-*random_suffix*** to show status `CREATE_COMPLETE`

### 4. Test the sample solution
The deployment script creates a Sample Solution App in the AWS cloud.
To test the sample solution, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [CloudWatch console](https://console.aws.amazon.com/cloudwatch/home)
3. Click on **All Metrics**
4. Select **SP-API/4xxErrors** under Custom namespaces
5. Click on **Metrics with no dimensions**
6. Select the first checkbox beside **Metric name 4/4**. This will select all 4 4xx error metrics
7. Click on **Graphed metrics**
8. With the 4 metrics selected, Select **Statistic** as **Sum** instead of **Average**

You will notice the number of 4xx errors that are being logged in the AWS CloudWatch. We have added Alarms in the sample solution to send alerts to the specified email id in the config when the 4xx errors cross a certain threshold.
In order to view the CloudWatch Alarm and the threshold, follow these steps:

1. Navigate to [CloudWatch console](https://console.aws.amazon.com/cloudwatch/home)
2. Click on **All Alarms**
3. Select one of the Alarms **sp-api-app-*random_suffix*-4xxAlarm** to view the Alarm details and the threshold which will trigger the email notification.

You can play around with the frequency and threshold of the 4xx errors you would like to monitor and the schedule of the EventBridge to trigger the Lambda function to run the setup.
If you need to make changes to the EventBridge schedule, follow these steps:

1. Change the schedule to minutes, hours or days in app config

In order to make changes to the 4xx error notification threshold, follow these steps:

1. Go to the **app-template.yaml** file.
2. Change the Period, EvaluationPeriod and Threshold for the 4xx Alarm: **400Alarm, 403Alarm, 404Alarm and 429Alarm**
```
Period: 300
EvaluationPeriods: 1
Threshold: 5
```

### 5. Clean-up
The deployment script creates a number of resources in the AWS cloud which you might want to delete after testing the solution.
To clean up these resources, follow the steps below.
1. Identify the clean-up script for the programming language of the Sample Solution App deployed to the AWS cloud.
    1. For example, for the Java application the file is [app/scripts/java/java-app-clean.sh](app/scripts/java/java-app-clean.sh)
2. Execute the script from your terminal or Git Bash
    1. For example, to execute the Java clean-up script in a Unix-based system or using Git Bash, run `bash java-app-clean.sh`

### 6. Troubleshooting
If you do not receive email notifications, follow the steps below to identify the root-cause and retry the workflow
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [Lambda console](https://console.aws.amazon.com/lambda/home)
3. Select the Lambda function created by the deployment script, named **ErrorMonitoringLambdaFunction-*random_suffix***
4. Click on **Test** tab
5. Select **Create new event**
6. Enter **Event Name**
7. Keep the event JSON as it is and click on **Save**
8. Once the Event JSON is saved, click on **Test** multiple times to trigger Lambda Function
9. Click on **Monitor** tab and select **View CloudWatch logs**
10. You will see CloudWatch logstreams created, select one of them to investigate if the Lambda function ran successfully and you are able to view the 4xx errors in the CloudWatch logs.