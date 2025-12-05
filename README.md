# Amazon Selling Partner API Samples

This repository contains sample code in various programming languages for use cases supported by the [Amazon Selling Partner API (SP-API)](https://developer-docs.amazon.com/sp-api/).

## Table of Contents
- [About this Repo ](#about-this-repo)
- [Learning Resources ](#learning-resources)
- [Security ](#security)
- [License ](#license)

## About this Repo
This repository contains two types of sample code:
- [Code Recipes](code-recipes): Easy to read sample code for common use cases of Amazon Selling Partner API. Recipes are written in multiple programming languages, and you can read or browse through them and copy parts of them over into your codebase.
- [Sample Solutions](use-cases): More complex solutions to demonstrate specific use cases in more detail. You can easily deploy them in AWS to learn and explore.
- [Labs](labs): Hands-on resources to help you learn and master flows and scenarios through Jupyter code samples, guided tutorials, and full workshop challenges.

### Code Recipes
| API | Use Case | Java | Python | PHP |
| --- | -------- | ---- | ------ | --- |
| AWD | Inbound Shipment Creation | [Link](code-recipes/java/src/main/java/awd/InboundOrderCreationRecipe.java) | - | [Link](code-recipes/php/src/awd/InboundOrderCreationRecipe.php) |
| A+ Content API | Submit an Image to A+ Content | [Link](code-recipes/java/src/main/java/aplus/UploadImageForResourceRecipe.java) | - | [Link](code-recipes/php/src/aplus/UploadImageForResourceRecipe.php) |
| Messaging API | Submit an Invoice to Buyer | [Link](code-recipes/java/src/main/java/messaging/SendInvoiceToBuyerRecipe.java) | - | [Link](code-recipes/php/src/messaging/SendInvoiceToBuyerRecipe.php) |
| Orders | B2B Delivery Experience | [Link](code-recipes/java/src/main/java/b2bdeliveryexperience/BusinessDeliveryExperienceRecipe.java) | - | [Link](code-recipes/php/src/b2bdeliveryexperience/BusinessDeliveryExperienceRecipe.php) |
| Data Kiosk | End-to-end Query Submission | [Link](code-recipes/java/src/main/java/datakiosk/DataKioskQueryRecipe.java) | [Link](code-recipes/python/src/recipes/datakiosk/datakiosk_query_recipe.py) | - |
| Easy Ship | Calculate Order Dimensions | [Link](code-recipes/java/src/main/java/easyship/CalculateOrderDimensionsRecipe.java) | - | [Link](code-recipes/php/src/easyship/CalculateOrderDimensionsRecipe.php) |
| Easy Ship | Create Scheduled Package | [Link](code-recipes/java/src/main/java/easyship/CreateScheduledPackageRecipe.java) | - | [Link](code-recipes/php/src/easyship/CreateScheduledPackageRecipe.php) |
| Easy Ship | Download Shipping Label | [Link](code-recipes/java/src/main/java/easyship/DownloadShippingLabelRecipe.java) | - | [Link](code-recipes/php/src/easyship/DownloadShippingLabelRecipe.php) |
| Easy Ship | Get Feed Document | [Link](code-recipes/java/src/main/java/easyship/GetFeedDocumentRecipe.java) | - | [Link](code-recipes/php/src/easyship/GetFeedDocumentRecipe.php) |
| Easy Ship | Get Handover Slots | [Link](code-recipes/java/src/main/java/easyship/GetHandoverSlotsRecipe.java) | - | [Link](code-recipes/php/src/easyship/GetHandoverSlotsRecipe.php) |
| Easy Ship | Get Scheduled Package | [Link](code-recipes/java/src/main/java/easyship/GetScheduledPackageRecipe.java) | - | [Link](code-recipes/php/src/easyship/GetScheduledPackageRecipe.php) |
| Easy Ship | Retrieve Order | [Link](code-recipes/java/src/main/java/easyship/RetrieveOrderRecipe.java) | - | [Link](code-recipes/php/src/easyship/RetrieveOrderRecipe.php) |
| Easy Ship | Submit Feed Request | [Link](code-recipes/java/src/main/java/easyship/SubmitFeedRequestRecipe.java) | - | [Link](code-recipes/php/src/easyship/SubmitFeedRequestRecipe.php) |

We welcome contributions to this repo in the form of fixes or improvements to existing content. For more information on contributing, please see the [CONTRIBUTING](CONTRIBUTING.md) guide.

This is considered an intermediate learning resource, and should typically be referenced after reading the [SP-API Documentation](https://developer-docs.amazon.com/sp-api). Please see [Learning Resources](#learning-resources) for additional resources.

## Learning Resources
* [SP-API Website](https://developer.amazonservices.com)
* [SP-API SDK](https://github.com/amzn/selling-partner-api-sdk)
* [SP-API Documentation](https://developer-docs.amazon.com/sp-api)
* [SP-API Developer Support](https://developer.amazonservices.com/support)

## Security

See [CONTRIBUTING](CONTRIBUTING.md) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.

