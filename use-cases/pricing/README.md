# Overview
This Sample Solution provides all required resources to deploy to the AWS cloud a fully functional SP-API application that implements the [Price adjustment automation workflows guide](https://developer-docs.amazon.com/sp-api/docs/price-adjustment-automation-workflows-guide) end-to-end.
Use this application to test the proposed solution, do changes and/or integrate it to your own product.

## Product Pricing API
The Selling Partner API for Pricing helps you programmatically retrieve product pricing and offer pricing information for Amazon Marketplace products.

If you haven't already, we recommend you to navigate the following resources:

* [Price Adjustment Automation Workflows Guide](https://developer-docs.amazon.com/sp-api/docs/price-adjustment-automation-workflows-guide)
* [Product Pricing API and Notifications Frequently Asked Questions](https://developer-docs.amazon.com/sp-api/docs/pricing-faqs)
* [Product Pricing API v2022-05-01 reference](https://developer-docs.amazon.com/sp-api/docs/product-pricing-api-v2022-05-01-reference)
* [Product Pricing API Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/product-pricing-api-v2022-05-01-use-case-guide)
* [Notifications API v1 Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide) 

## Solution
This Sample Solution implements a re-pricing workflow that reacts to incoming [ANY_OFFER_CHANGED](https://developer-docs.amazon.com/sp-api/docs/notification-type-values#any_offer_changed) and [PRICING_HEALTH](https://developer-docs.amazon.com/sp-api/docs/notification-type-values#pricing_health) notifications calculating a new competitive price for the related selling partner's SKUs in order to achieve featured offer eligibility. If the new calculated price is above the minimum threshold defined by the selling partner, the solution executes a price change.

The solution consists of the following components:
* A [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional re-pricing workflow
* [Lambda](https://aws.amazon.com/lambda/) functions that support each of the steps of the state machine
* An [SQS](https://aws.amazon.com/sqs/) queue to receive ANY_OFFER_CHANGED and PRICING_HEALTH notifications
* A [DynamoDB](https://aws.amazon.com/dynamodb/) table to store re-pricing rules for the selling partner's SKUs
* A [Secrets Manager](https://aws.amazon.com/secrets-manager/) secret to securely store SP-API app credentials

### Workflow

The application waits for incoming SP-API [ANY_OFFER_CHANGED](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#any_offer_changed) or [PRICING_HEALTH](https://developer-docs.amazon.com/sp-api/docs/notification-type-values#pricing_health) notifications. These events are processed by the **SPAPIProcessNotificationLambdaFunction**, which starts a Step Functions state machine execution with the re-pricing logic.

The state machine retrieves from the database all the selling partner's SKUs associated to the ASIN of the notification. Next, each SKU is processed individually. If not present in the notification payload, the **SPAPIFetchPriceLambdaFunction** retrieves additional pricing information for the SKU using the Product Pricing API. The **SPAPICalculateNewPriceLambdaFunction** calculates a new competitive price using the price change rule specified for the SKU in the database. The supported rules are "FIXED" for a fixed deduction to the featured offer price (e.g. featured offer price - $0.01), "PERCENTAGE" for a percentage deduction to the featured offer price (e.g. featured offer price - 5%) and `UseCompetitivePrice` a bool value which when set as `true`, reprice the item using the competitivePriceThreshold value from [PRICING_HEALTH](https://developer-docs.amazon.com/sp-api/docs/notification-type-values#pricing_health) notification when available. Finally, if the new calculated price is above the specified minimum threshold, the **SPAPISubmitPriceLambdaFunction** submits the price change using the Listings Items API.

## Pre-requisites
The pre-requisites for deploying the Sample Solution App to the AWS cloud are:
* [Registering as a developer for SP-API](https://developer-docs.amazon.com/sp-api/docs/registering-as-a-developer), and [registering an SP-API application](https://developer-docs.amazon.com/sp-api/docs/registering-your-application)
* An [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) with permissions to create a new user, a policy, and attach it to the user
    * If you don't have one, you can create it following the steps  under **Usage - 2. Configure Sample Solution App's IAM user**
* The [AWS CLI](https://aws.amazon.com/cli/)
    * If not present, it will be installed as part of the deployment script
* The Python app requires the following packages: `boto3`, `requests`, and `setuptools`. If not present, they will be installed as part of the deployment script
* [GitBash](https://git-scm.com/download/win)
   * in case you use Windows in order to run the deployment script.

## Usage
### 1. Update config file
To allow the Sample Solution App to connect to SP-API, the config file has to be updated to match the set-up of your SP-API application.
1. Open [app.config](app/app.config) file and replace all occurrences of `<dev_value>` following the instructions below:
2. Update `ClientId` and `ClientSecret` attribute values with [Client Id and Client Secret of the SP-API application](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials) respectively
3. Update `RefreshToken` attribute value with the refresh token of the selling partner you will be using for testing
4. Update `RegionCode` attribute value with the region of the selling partner you will be using for testing. Valid values are `NA`, `EU`, `FE` for production usage or `NA_SANDBOX`, `EU_SANDBOX` and `FE_SANDBOX` for Sandbox testing.

>Note: While updating the config file, don't leave blank spaces before and after `=`, and don't use quotation marks

#### Sample config file:
```
ClientId=amzn1.application-oa2-client.abc123def456xyz789
ClientSecret=amzn1.oa2-cs.v1.abc123def456xyz789
RefreshToken=Atzr|Abc123def456xyz789
RegionCode=NA_SANDBOX
```

### 2. Configure Sample Solution App's IAM user
#### I. Create IAM user
In order to execute the deployment script, an IAM user with `IAMFullAccess` permissions is needed.
To create a new IAM user with required permissions, follow the steps below. If you already have a user with `IAMFullAccess` policy, you can skip to **Configure IAM user credentials** section
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home#/users)
3. Click **Add users**
4. Select a name for your user
5. In the **Set permissions** page, select **Attach policies directly**
6. In the **Permissions policies**, search for `IAMFullAccess`. Check the policy, and click **Next**
7. Review the changes and click **Create user**

#### II. Retrieve IAM user credentials
Security credentials for the IAM user will be requested during the deployment script execution.
To create a new access key pair, follow the steps below. If you already have valid access key and secret access key, you can skip this section.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [IAM Users console](https://us-east-1.console.aws.amazon.com/iamv2/home#/users)
3. Select your IAM user, which has `IAMFullAccess` permissions
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
    1. For example, for the Python application the file is [app/scripts/python/python-app.sh](app/scripts/python/python-app.sh)
2. Execute the script from your terminal or Git Bash
    1. For example, to execute the Python deployment script in a Unix-based system or using Git Bash, run `bash python-app.sh`
3. Wait for the CloudFormation stack creation to finish
    1. Navigate to [CloudFormation console](https://console.aws.amazon.com/cloudformation/home)
    2. Wait for the stack named **sp-api-app-\<language\>-*random_suffix*** to show status `CREATE_COMPLETE`

### 4. Test the sample solution
The deployment script creates a Sample Solution App in the AWS cloud. The solution consists of a [Step Functions](https://aws.amazon.com/step-functions/) state machine with a fully functional workflow.
To test the sample solution, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [DynamoDB items console](https://console.aws.amazon.com/dynamodbv2/home?#item-explorer) 
3. Under **Tables**, select the table created by the deployment script, named **SPAPISellerItemsTable-*random_suffix***
4. Select **Create new item** and add the following attributes with the corresponding value:

   1. **ASIN** (Type `String`): The ASIN that you will use for testing
   2. **SKU** (Type `String`): The SKU that you will use for testing
   3. **SellerId** (Type `String`): The id of the seller that you will use for testing
   4. **MarketplaceId** (Type `String`): The id of the marketplace that you will use for testing
   5. **Condition** (Type `String`): The condition of the item that you will use for testing. Valid values: `new`, `used` (for Python) or `New`, `Used` (for Java)
   6. **IsFulfilledByAmazon** (Type `Boolean`): `true` if the item that you will use for testing is fulfilled by Amazon, `false` otherwise
   7. **PriceChangeRule** (Type `String`): The price change rule of the SKU. Valid values: `FIXED`, `PERCENTAGE`
   8. **PriceChangeRuleAmount** (Type `Number`): The price change rule amount. This amount will be related to the price change rule chosen in step 7. For example, if the `PriceChangeRuleAmount` is set to `10`, it could be interpreted as `10 USD` or `10%` depending on the value of the `PriceChangeRule`.
   9. **MinThreshold** (Type `Number`): The minimum monetary list price for the SKU. Example: 10 (= 10 USD/EUR)
   10. **UseCompetitivePrice** (Type `Bool`): To accept the usage of `useCompetitivePrice` rule from `PRICING_HEATH` notification. To understand more about this attribute check [Pricing FAQs](https://developer-docs.amazon.com/sp-api/docs/pricing-faqs#what-is-the-competitive-price-threshold-competitivepricethreshold)

To test in sandbox environment, add the following item into DynamoDB:

In the **Create Item** page select **JSON view** on the right side, copy and paste the item below and click in create item.  

```
{"ASIN":{"S":"B00V5DG6IQ"},"SKU":{"S":"NABetaASINB00V5DG6IQ"},"Condition":{"S":"new"},"IsFulfilledByAmazon":{"BOOL":false},"MarketplaceId":{"S":"ATVPDKIKX0DER"},"MinThreshold":{"N":"5"},"PriceChangeRule":{"S":"FIXED"},"PriceChangeRuleAmount":{"N":"1"},"SellerId":{"S":"AXXXXXXX"},"UseCompetitivePrice":{"BOOL":true}}

```

5. Navigate to [SQS console](https://console.aws.amazon.com/sqs/v2/home)
6. Select the SQS queue created by the deployment script, named **sp-api-notifications-queue-*random_suffix***
7. Select **Send and receive messages**
8. Under **Message body**, insert the following simplified notification body. To test the `ANY_OFFER_CHANGED` notification, use the following message in the SQS queue: 

If you want to test with production data, replace all attributes with the real values for ASIN, SellerId and MarketplaceId.

```
{
  "EventTime": "2023-07-31T20:41:15.002Z",
  "PayloadVersion": "1.0",
  "NotificationType": "ANY_OFFER_CHANGED",
  "NotificationVersion": "1.0",
  "Payload": {
    "AnyOfferChangedNotification": {
      "SellerId": "AMY6FKRUBY7XV",
      "OfferChangeTrigger": {
        "MarketplaceId": "ATVPDKIKX0DER",
        "ASIN": "B00V5DG6IQ",
        "ItemCondition": "new",
        "TimeOfOfferChange": "2023-07-31T20:40:53.101Z",
        "OfferChangeType": "Internal"
      },
      "Summary": {
        "BuyBoxPrices": [
          {
            "Condition": "New",
            "LandedPrice": {
              "Amount": 10.00,
              "CurrencyCode": "USD"
            },
            "ListingPrice": {
              "Amount": 9.00,
              "CurrencyCode": "USD"
            },
            "Shipping": {
              "Amount": 1.00,
              "CurrencyCode": "USD"
            }
          }
        ]
      },
      "Offers": [
        {
          "SellerId": "AMY6FKRUBY7XV",
          "SubCondition": "new",
          "ListingPrice": {
            "Amount": 20.00,
            "CurrencyCode": "USD"
          },
          "Shipping": {
            "Amount": 1.00,
            "CurrencyCode": "USD"
          },
          "ShipsFrom": {
            "Country": "US",
            "State": "WA"
          },
          "IsFulfilledByAmazon": false,
          "IsBuyBoxWinner": false
        }
      ]
    }
  }
}
```

To test the `PRICING_HEALTH` notification, use the following message for sandbox testing or change sellerId, asin and marketplaceId to test in production:

```
{
  "notificationVersion": "1.0",
  "notificationType": "PRICING_HEALTH",
  "payloadVersion": "1.0",
  "eventTime": "2020-09-23T21:30:13.713Z",
  "payload":
  {
    "issueType": "BuyBoxDisqualification",
    "sellerId": "AMY6FKRUBY7XV",
    "offerChangeTrigger":
    {
      "marketplaceId": "ATVPDKIKX0DER",
      "asin": "B00V5DG6IQ",
      "itemCondition": "new",
      "timeOfOfferChange": "2020-09-23T21:30:13.409Z"
    },
    "merchantOffer":
    {
      "condition": "new",
      "fulfillmentType": "MFN",
      "listingPrice":
      {
        "amount": 1200,
        "currencyCode": "USD"
      },
      "shipping":
      {
        "amount": 100,
        "currencyCode": "USD"
      },
      "landedPrice":
      {
        "amount": 1300,
        "currencyCode": "USD"
      },
      "points":
      {
        "pointsNumber": 0
      }
    },
    "summary":
    {
      "numberOfOffers": [
        {
          "condition": "new",
          "fulfillmentType": "MFN",
          "offerCount": 3
        }
      ],
      "buyBoxEligibleOffers": [
        {
          "condition": "new",
          "fulfillmentType": "MFN",
          "offerCount": 3
        }
      ],
      "buyBoxPrices": [
        {
          "condition": "new",
          "listingPrice":
          {
            "amount": 900,
            "currencyCode": "USD"
          },
          "shipping":
          {
            "amount": 100,
            "currencyCode": "USD"
          },
          "landedPrice":
          {
            "amount": 1000,
            "currencyCode": "USD"
          },
          "points":
          {
            "pointsNumber": 0
          }
        }
      ],
      "referencePrice":
      {
        "averageSellingPrice":
        {
          "amount": 1050,
          "currencyCode": "USD"
        },
        "competitivePriceThreshold":
        {
          "amount": 980,
          "currencyCode": "USD"
        },
        "msrpPrice":
        {
          "amount": 1300,
          "currencyCode": "USD"
        },
        "retailOfferPrice":
        {
          "amount": 1000,
          "currencyCode": "USD"
        }
      }
    }
  }
}

```
9. Click **Send message**
10. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
11. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***
12. Under **Executions**, you will see a workflow for the notification submitted through SQS
13. To check the workflow status and navigate into the individual steps, select the workflow and use the **Graph view** and **Step Detail** panels

### 5. Extra
The deployment script also creates a Lambda function that subscribes selling partners to notifications. You can integrate this function to your product to easily onboard to the notifications feature.
To test the function, follow the steps below.
1. Open the [AWS console](https://console.aws.amazon.com/)
2. Navigate to [Lambda console](https://console.aws.amazon.com/lambda/home)
3. Select the notification subscriber function, named **SPAPISubscribeNotifications-*random_suffix***
4. Select **Test** tab
5. Under **Event JSON**, insert the following payload. Replace `RefreshToken`, `RegionCode` and `NotificationType` with the corresponding values of the selling partner and notification type you want to subscribe to.
    ```
    {
        "NotificationType": "PRICING_HEALTH",
        "RegionCode": "NA|EU|FE",
        "RefreshToken": "Atzr|Iw..."
    }
    ```
6. Click **Test**
7. The function will return `destination Id` and `subscription Id`

### 6. Clean-up
The deployment script creates a number of resources in the AWS cloud which you might want to delete after testing the solution.
To clean up these resources, follow the steps below.
1. Identify the clean-up script for the programming language of the Sample Solution App deployed to the AWS cloud.
    1. For example, for the Python application the file is [app/scripts/python/python-app-clean.sh](app/scripts/python/python-app-clean.sh)
2. Execute the script from your terminal or Git Bash
    1. For example, to execute the Python clean-up script in a Unix-based system or using Git Bash, run `bash python-app-clean.sh`

### 7. Troubleshooting
If the state machine execution fails, follow the steps below to identify the root-cause and retry the workflow
1. Navigate to [Step Functions console](https://console.aws.amazon.com/states/home)
2. Select the state machine created by the deployment script, named **SPAPIStateMachine-*random_suffix***
3. Under **Executions**, you can use the **Status** column to identify failed executions
4. To troubleshoot errors, select the corresponding workflow execution and use the **Graph view** and **Step Detail** panels
5. After fixing the issues that caused the error, retry the workflow by clicking on **New execution**. The original input parameters will be automatically populated
6. Click **Start execution**, and validate the results