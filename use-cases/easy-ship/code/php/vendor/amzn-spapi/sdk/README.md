## PHP SDK for Selling Partner API

The Selling Partner API SDK for PHP enables you to easily connect your PHP application to Amazon's REST-based SP-API.

* [Learn more about SP-API](https://developer.amazonservices.com/)
* [API Documentation](https://developer-docs.amazon.com/sp-api/)

### Getting started

#### Credentials

Before you can use the SDK, you need to be registered as a Selling Partner API developer. If you haven't done that yet, please follow the instructions in the [documentation](https://developer-docs.amazon.com/sp-api/docs/sp-api-registration-overview).
You also need to register your application to get valid credentials to call SP-API. If you haven't done that yet, please follow the instructions in the [documentation](https://developer-docs.amazon.com/sp-api/docs/registering-your-application).
If you are already registered successfully, you can find instructions on how to view your credentials in the [documentation](https://developer-docs.amazon.com/sp-api/docs/viewing-your-application-information-and-credentials).

## Installation & Usage

### Minimum Requirements

To run the SDK you need PHP 7.4 or higher.


### Manual Installation

By using the download files, composer dependencies are already installed. You only need to include `autoload.php`:

```php
<?php
require_once('/path/to/OpenAPIClient-php/vendor/autoload.php');
```

### Use the SDK

In order to call one of the APIs included in the Selling Partner API, you need to:
* Configure credentials and marketplace ids. We provided a .env file to test the SDK in php/sdk/.env
* Create an instance for a specific API (e.g. Orders API)
* Call an operation

```php
<?php
require_once(__DIR__ . '/vendor/autoload.php');

use SpApi\AuthAndAuth\LWAAuthorizationCredentials;
use SpApi\AuthAndAuth\LWAAuthorizationSigner;
use SpApi\Api\OrdersApi;
use SpApi\Configuration;


// Set up LWA credentials
$lwaAuthorizationCredentials = new LWAAuthorizationCredentials([
"clientId" => "amzn1.application-**************",
"clientSecret" => "***********",
"refreshToken" => "***********",
"endpoint" => "https://api.amazon.com/auth/o2/token"
]);

// Initialize LWAAuthorizationSigner instance
$lwaAuthorizationSigner = new LWAAuthorizationSigner($lwaAuthorizationCredentials);
$config = new Configuration([], $lwaAuthorizationCredentials);

// Setting SP-API endpoint region
$config->setHost('https://sellingpartnerapi-na.amazon.com');

// Create a new HTTP client
$client = new GuzzleHttp\Client();

// Create an instance of the Orders Api
$api = new OrdersApi($config, null, $client);

try {
// Call getOrders
$result = $api->getOrders(
$marketplace_ids = ['ATVPDKIKX0DER'],
$created_after = '2024-01-01'
);
print_r($result);
} catch (Exception $e) {
echo 'Exception when calling OrderApi->getOrders: ', $e->getMessage(), PHP_EOL;
}



```

### Giving Feedback

We need your help in making this SDK great. Please participate in the community and contribute to this effort by submitting issues, participating in discussion forums and submitting pull requests through the following channels:

Submit [issues][sdk-issues] - this is the preferred channel to interact with our team
Articulate your feature request or upvote existing ones on our [Issues][sdk-issues] page

[sdk-issues]: https://github.com/amzn/selling-partner-api-sdk/issues



## Disclaimer

- [FBA Inbound V0 API](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v0-reference) is named as FBAInboundApi.php
- [FBA Inbound v2024-03-20 API](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference) is named as FulfillmentInboundApi.php
- [FBA Eligibility API](https://developer-docs.amazon.com/sp-api/docs/fbainboundeligibility-api-v1-model) and [PricingV0 API](https://developer-docs.amazon.com/sp-api/docs/product-pricing-api-v0-reference) operations are still not supported.
- [Finances API](https://developer-docs.amazon.com/sp-api/docs/finances-api-v2024-06-19-reference) is named as DefaultApi.php.
