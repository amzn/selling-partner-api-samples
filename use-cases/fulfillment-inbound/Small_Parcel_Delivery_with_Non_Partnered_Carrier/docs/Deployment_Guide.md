## Deployment Guide

This deployment guide provides a comprehensive set of instructions to set up, deploy, and test an AWS-based sample
solution that integrates with Amazon's Fulfillment Inbound API (v2024).

## Sample Solution Components

The solution utilizes the following AWS Services:

* [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional Fulfillment Inbound
  v2024 SPD nPCP Workflow.
* [Lambda Functions](https://aws.amazon.com/lambda/) that support each of the steps of the state machine. Each Lambda
  function represents an API Operation.
* [Simple Notification Service (SNS)](https://aws.amazon.com/sns/) to notify below,
    * Failure in any of the workflow operations.
    * Notify and share the generated shipment box labels via email.
* [Secrets Manager](https://aws.amazon.com/secrets-manager/) secret to securely store SP-API app credentials.

## Pre-requisites

The pre-requisites for deploying the FBA Inbound Sample Solution App to the AWS cloud are:

1. [Registering as a Developer for SP-API](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer)
   and [Registering an SP-API application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application).
2. [FBA Inbound v2024 prerequisites.](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide#prerequisites)
3. [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with permissions to create a new user, a
   policy, and attach it to the user.
    * If you don't have one, you can create it following the steps under **Usage - 2. Configure Sample Solution App's
      IAM user.**
4. [AWS CLI](https://aws.amazon.com/cli/)
    * If not present, it will be installed as part of the deployment script.
5. [Maven](https://maven.apache.org/)
    * It is used for deploying a Java-based application.
    * If not present, it will be installed as part of the deployment script.
6. [GitBash](https://git-scm.com/download/win)
    * In case you use Windows in order to run the deployment script.

## Deployment Instructions

### 1. Update config file

To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your
SP-API application.

#### Open [app.config](app/app.config) file and replace all occurrences of `<dev_value>` following the instructions below,

* Update `ClientId` and `ClientSecret` attribute values with
  [Client Id and Client Secret of the SP-API application](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials)
  respectively.

* Update `Email` with email ID where you want to get the shipment labels and operation failure details.

> Note: While updating the config file, don't leave blank spaces before and after `=`, and don't use quotation marks

#### Sample config file,

```
ClientId=amzn1.application-oa2-client.abc123def456xyz789
ClientSecret=amzn1.oa2-cs.v1.abc123def456xyz789
Email=test@test.com
```

### 2. Configure Sample Solution App's IAM user

#### I. Create IAM policy

In order to execute the deployment script, an IAM user with the appropriate permissions is needed. To create a new IAM
policy with the required permissions, follow the steps below,

1. Open the [AWS console](https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1).
2. Navigate to [IAM Policies console](https://us-east-1.console.aws.amazon.com/iamv2/home#/policies).
3. Click **Create policy.**
4. Next to **Policy editor**, select **JSON** and replace the default policy with the JSON below. Make sure to
   replace `<aws_account_id_number>` your AWS account id number.

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
                "arn:aws:iam::<aws_account_id_number>:user/*",
                "arn:aws:iam::<aws_account_id_number>:policy/*"
            ]
        }
    ]
 }
```

5. Click **Next.**
6. Select a name for your policy. Take note of this value as you will need it in the next section.
7. Review the changes and click **Create policy.**

#### II. Create IAM user

To create a new IAM user with the required permissions, follow the steps below,

1. Open the [AWS console](https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1).
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/users).
3. Click **Create user.**
4. Select a name for your user.
5. In the **Set permissions** page, select **Attach policies directly.**
6. In the **Permissions policies,** search for the policy created in **I. Create IAM policy** section. Select the
   policy, and click **Next.**
7. Review the changes and click **Create user.**

#### III. Retrieve IAM user credentials

Security credentials for the IAM user will be requested during the deployment script execution. To create a new access
key pair, follow the steps below.
If you already have valid access key and secret access key, you can skip this section.

1. Open the [AWS console](https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1).
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/users).
3. Select your IAM user created in **II. Create IAM user.**
4. Go to **Security credentials** tab.
5. Under **Access keys**, click **Create access key.**
6. In **Access key best practices & alternatives** page, select **Command Line Interface (CLI).**
7. Acknowledge the recommendations, and click **Next.**
8. Click **Create access key.**
9. Copy `Access key` and `Secret access key`. This is the only time that these keys can be viewed or downloaded, and you
   will need them while executing the deployment script.
10. Click **Done.**

### 3. Execute the deployment script

The deployment script will create a Sample Solution App in the AWS cloud. To execute the deployment script, follow the
steps below,

1. Identify the deployment script for the programming language you want for your Sample Solution App,
    * For the Java application the file is [app/scripts/java/java-app.sh](app/scripts/java/java-app.sh)
2. Execute the script from your terminal,
    * To execute the Java deployment script in a Unix-based system, run `bash java-app.sh`.
3. Wait for the CloudFormation stack creation to finish,
    * Navigate
      to [CloudFormation console](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks?filteringText=&filteringStatus=active&viewNested=true).
    * Wait for the stack named sp-api-app-random_suffix to show status `CREATE_COMPLETE`.

### 4. Clean-up

The deployment script creates a number of resources in the AWS cloud which you might want to delete after testing the
solution. To clean up these resources, follow the steps below,

1. Identify the clean-up script for the programming language of the Sample Solution App deployed to the AWS cloud,
    * For the Java application the file is [app/scripts/java/java-app-clean.sh](app/scripts/java/java-app-clean.sh).
2. Execute the script from your terminal,
    * To execute the Java clean-up script in a Unix-based system or using Git Bash, run `bash java-app-clean.sh`. Wait
      for the script to complete.

### 5. Troubleshooting

If the state machine execution fails, follow the steps below to identify the root-cause and retry the workflow,

1. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home).
2. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix.***
3. Under **Executions**, you can use the **Status** column to identify failed executions.
4. To troubleshoot errors, select the corresponding workflow execution and use the **Graph view** and **Step Detail**
   panels. Look into the **Lambda Log Group** to look into detailed errors messages.
5. After fixing the issues that caused the error, retry the workflow by clicking on **New execution**. The original
   input parameters will be automatically populated.
6. Click **Start execution**, and validate the results
