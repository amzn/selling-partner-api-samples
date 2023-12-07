# SellingPartnerAPIListingSampleApplication

## Introduction

This app demonstrates how to use the APIs listed in [Building Listings Management Workflows Guide](https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide) to construct common listing management workflows using a simple UI. The Selling Partner API (SP-API) is a REST-based API that helps Amazon selling partners programmatically access their data on listings, orders, shipments, payments, etc. The Listings APIs are a subset of the SP-API which allows the users to build listings creation and management workflows.

## Sample Video Tutorial

[![ Listings Sample Solution: Setup & Installation ](https://img.youtube.com/vi/dGmlveknTks/sddefault.jpg)](https://www.youtube.com/watch?v=dGmlveknTks)

## Getting Started

### Prerequisites

1. This app requires a browser which supports Javascript ES6 (2015).
2. This app requires at least NodeJS 14.18.0, so please install a supported [version](https://nodejs.org/en/).
   1. For Windows and MacOS operating systems, [download the installer](https://nodejs.org/en/download) and run the installer.
   2. For the Unix / Linux operating systems, install through the [package manager](https://nodejs.org/en/download/package-manager).
3. Install [Git](https://git-scm.com/downloads) to check out the source code of this app.
   1. For Windows operating system, [download the installer](https://git-scm.com/download/win) and run the installer.
   2. For the MacOS operating system, install [Homebrew](https://brew.sh/) and run the command `brew install git`.
   3. For the Unix / Linux operating systems, install through the [package manager](https://git-scm.com/download/linux).
4. Install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
   1. For Windows operating system, [download the installer](https://awscli.amazonaws.com/AWSCLIV2.msi) and run the installer.
   2. For the MacOS operating system, [download the installer](https://awscli.amazonaws.com/AWSCLIV2.pkg) and run the installer.
   3. For the Unix / Linux operating systems, it takes multiple steps for the installation. Click the [link](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html#getting-started-install-instructions) and expand the Linux section to view the installation instructions.
5. This app requires an AWS Account for the Notifications workflow and to store the app settings in a secure manner. AWS charges this account if it receives the listing notifications through this app. If you are not already an AWS customer, you can create a [free AWS account](https://aws.amazon.com/free).
6. This app requires a professional seller or vendor account to integrate with the SP-API. If you do not have a professional seller or vendor account, then create a new seller account. Refer to [Start selling with Amazon](https://sell.amazon.com/).
7. This app requires the credentials of a selling partner application which has access to the [Product Listing role](https://developer-docs.amazon.com/sp-api/docs/product-listing-role). If you do not have a selling partner application, then [create a new application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application) by registering as SP-API developer. An SP-API developer can develop a private seller application, private vendor application or public application. Any application works for this app.
8. This app requires the authorization of a seller or vendor account with the above application. Refer to [Authorizing Selling Partner API applications](https://developer-docs.amazon.com/sp-api/docs/authorizing-selling-partner-api-applications)

### How to run the app

1. Check out the repository to your computer from Git through the command `git clone https://github.com/amzn/selling-partner-api-samples.git`.
2. Open the `selling-partner-api-samples/use-cases/listings/` folder.
3. Run the command `npm install` to install the node modules necessary to run the app.
4. Follow the instructions in **Configure the AWS CLI** section to create an IAM user and configure the AWS CLI.
5. Run the command `npm run build` to build the app.
6. Run the command `npm run startserver` to run the app. This command starts the server on port number 3000.
7. Open [http://localhost:3000](http://localhost:3000/) with your browser to view the homepage of the app.
   **Note** : Some of the scripts in the package.json does not work on computers which run on Windows operating system.

## Configure the AWS CLI

### Create IAM policy

The app requires an IAM user with the appropriate permissions to run the app. Follow the steps below to create a
new policy with the necessary permissions.

1. Open the [AWS console](https://console.aws.amazon.com/).
2. Navigate to [IAM Policies console](https://us-east-1.console.aws.amazon.com/iamv2/home#/policies).
3. Click **Create policy**.
4. Next to **Policy editor**, select **JSON** and replace the default policy with the JSON below.
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "SettingsPersistencePermissions",
         "Action": [
           "secretsmanager:CreateSecret",
           "secretsmanager:GetSecretValue",
           "secretsmanager:PutSecretValue"
         ],
         "Resource": "arn:aws:secretsmanager:us-west-2:*:secret:settings*",
         "Effect": "Allow"
       },
       {
         "Sid": "NotificationsQueueManagementPermissions",
         "Action": ["sqs:CreateQueue", "sqs:DeleteQueue"],
         "Resource": [
           "arn:aws:sqs:*:*:BrandedItemContentChangeQueue",
           "arn:aws:sqs:*:*:ItemProductTypeChangeQueue",
           "arn:aws:sqs:*:*:ListingsItemStatusChangeQueue",
           "arn:aws:sqs:*:*:ListingsItemIssuesChangeQueue",
           "arn:aws:sqs:*:*:ListingsItemMFNQuantityChangeQueue",
           "arn:aws:sqs:*:*:ProductTypeDefinitionsChangeQueue"
         ],
         "Effect": "Allow"
       },
       {
         "Sid": "NotificationsEventBusPermissions",
         "Action": ["events:CreateEventBus"],
         "Resource": "arn:aws:events:*:*:event-bus/aws.partner/sellingpartnerapi.amazon.com/*",
         "Effect": "Allow"
       },
       {
         "Sid": "NotificationsEventBusRulePermissions",
         "Action": [
           "events:PutRule",
           "events:ListRules",
           "events:ListTargetsByRule",
           "events:PutTargets",
           "events:RemoveTargets",
           "events:DeleteRule"
         ],
         "Resource": "arn:aws:events:*:*:rule/aws.partner/sellingpartnerapi.amazon.com/*",
         "Effect": "Allow"
       }
     ]
   }
   ```
5. Click **Next**.
6. Select a name for your policy. The next section requires this policy. So take a note of it.
7. Review the changes and click **Create policy**.

### Create IAM user

Follow the steps below to create a new IAM user with the necessary permissions

1. Open the [AWS console](https://console.aws.amazon.com/).
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home#/users).
3. Click **Create user**.
4. Select a name for your user.
5. In the **Set permissions** page, select **Attach policies directly**.
6. In the **Permissions policies**, search for the policy created in **Create IAM policy** section. Select the policy, and click **Next**.
7. Review the changes and click **Create user**.

### Retrieve IAM user credentials and configure AWS CLI

The app requires the security credentials for the IAM user to persist the settings into AWS Secret Manager and create the AWS infrastructure to receive the notifications.
Follow the steps below to create a new access key pair. Skip this section if you already have valid access key and secret access key.

1. Open the [AWS console](https://console.aws.amazon.com/).
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home#/users).
3. Select the IAM User created in **Create IAM user** section.
4. Go to **Security credentials** tab.
5. Under **Access keys**, click **Create access key**.
6. In **Access key best practices & alternatives** page, select **Command Line Interface (CLI)**.
7. Acknowledge the recommendations, and click **Next**.
8. Click **Create access key**.
9. Click "Download .csv file" button to download the access keys as a csv file.
10. Click **Done**.
11. Run the command `aws configure` to [configure the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-authentication-user.html#cli-authentication-user-configure-wizard) to use the access keys from the CSV file. 
12. Delete the csv file which contains the access keys.

## Configure Settings inside the app

Use the settings gear icon to access the settings page. The settings page displays a form to configure the settings with the following fields.

1. **AccountId** : Enter the account Id of the AWS account. This account contains the infrastructure to receive notifications and store app settings. Refer to [View AWS account identifiers](https://docs.aws.amazon.com/accounts/latest/reference/manage-acct-identifiers.html) to locate the AWS account ID. Please delete all the subscriptions created through the app when you change the account Id.
2. **Client Id** : Enter the Client Id part of the selling partner application LWA credentials mentioned in the Prerequisites section. Refer to [Viewing your application information and credentials](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials)
3. **Client Secret** : Enter the Client Secret part of the selling partner application LWA credentials mentioned in the Prerequisites section.
4. **Refresh Token** : Enter the refresh token which authorizes the selling partner application to submit SP-API requests. Refer to [Authorizing Selling Partner API applications](https://developer-docs.amazon.com/sp-api/docs/authorizing-selling-partner-api-applications).
5. **Selling Partner Id Type** : For the seller applications, select "Merchant Account Id". For the vendor applications, select "Vendor Code".
6. **Selling Partner Id** : For the seller applications, enter the [Merchant Token from the Seller central](https://sellercentral.amazon.com/account-information/merchant-token). For the vendor applications, enter the vendor code of the selling account.
7. **Marketplace Id** : Enter the marketplaceId of the selling account. Refer to [Marketplace IDs](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids).
8. **Region** : Select the SP-API endpoint AWS region based on your selected marketplaceId. Refer to [SP-API Endpoints](https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints). The app creates any infrastructure for the notifications workflow in the selected region.

Click the Save button to save the settings into [AWS Secret Manager.](https://aws.amazon.com/secrets-manager/) The settings page uses the AWS credentials of the above IAM User to persist the settings. If the policies for the above IAM User are incorrect, then the settings page may fail to persist the settings.

## Verify the app runs successfully

1. Open [http://localhost:3000](http://localhost:3000/) with your browser to view the homepage of the app.
2. Configure the app as per the above instructions.
3. Click on the "Create Listing" button in the navigation bar to view [Create Listing Page](http://localhost:3000/create-listing)
4. Enter "chair" into the keywords text field and click on "SEARCH PRODUCT TYPE" button.
5. Ensure the "Choose a Product Type" drop-down appears and verify if the CHAIR product type is present in the drop-down.
6. Open the debug console and verify if the SearchDefinitionsProductType is present in the console.

## See also

1. [SP-API documentation](https://developer-docs.amazon.com/sp-api/docs/welcome)
2. [Building Listings Management Workflows Guide](https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide)
3. [AWS EventBridge](https://aws.amazon.com/eventbridge/)
4. [AWS SQS](https://aws.amazon.com/sqs/)
5. [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
6. [NodeJS](https://nodejs.org/en/)
7. [React](https://react.dev/)
8. [NextJS](https://nextjs.org/)
9. [Material UI](https://mui.com/material-ui/)
10. [TypeScript](https://www.typescriptlang.org/)
