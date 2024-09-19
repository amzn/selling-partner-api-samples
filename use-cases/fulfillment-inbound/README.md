## Overview of Fulfillment Inbound API v2024-03-20

The Fulfillment Inbound API allows sellers to automate and manage their inbound shipping processes to Amazon’s
fulfillment network. This API is particularly useful for businesses looking to streamline their inventory management and
shipping operations. It integrates smoothly with the Send-to-Amazon (STA) feature in the Seller Central User Interface,
ensuring interoperability and ease of use.

## Key Resources

- [Fulfillment Inbound API v2024-03-20 Reference](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-reference):
  Detailed documentation on API endpoints, request/response structures, and error handling.
- [Fulfillment Inbound API v2024-03-20 Use Case Guide](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-use-case-guide):
  Practical examples and scenarios to help you implement the API effectively.

## Sample Solution

The FBA Inbound Sample Solution App provides all required resources to deploy a fully functional SP-API application that
implements the new **Fulfillment By Amazon (FBA) Inbound API v2024-03-20**. It demonstrates end-to-end implementation
of two business use-cases:

- [Small Parcel Delivery (SPD) with Amazon Partnered Carrier (PCP)](https://github.com/amzn/selling-partner-api-samples/tree/main/use-cases/fulfillment-inbound/Small_Parcel_Delivery_with_Amazon_Partnered_Carrier)
- [Small Parcel Delivery (SPD) with Non-Partnered Carrier (nPCP)](https://github.com/amzn/selling-partner-api-samples/tree/main/use-cases/fulfillment-inbound/Small_Parcel_Delivery_with_Non_Partnered_Carrier)

## Workflow

### 1. Small Parcel Delivery (SPD) with Amazon Partnered Carrier (PCP)

This workflow is ideal for businesses that prefer using Amazon's partnered transportation carriers. The workflow
includes:

- **Inbound Plan Creation:** Initiate inbound plans for shipping inventory, specifying SKUs and quantities.
- **Packing Selection:** Choose from available packing options to prepare your shipment.
- **Placement Selection:** Select the most cost-effective placement option for your inventory.
- **Transportation Carrier Selection:** Automatically select Amazon’s partnered carrier for small parcel delivery
  ensuring reliable and cost-effective shipping.
- **Shipping Labels and Tracking:** Generate necessary shipping labels for FBA boxes and carriers, and obtain tracking
  information to monitor shipment progress.

### 2. Small Parcel Delivery (SPD) with Non-Partnered Carrier (nPCP):

This workflow is suited for businesses that prefer using their own transportation carriers. The workflow includes:

- **Inbound Plan Creation:** Similar to the PCP workflow, create inbound plans with defined SKU items.
- **Packing Selection:** Select appropriate packing option.
- **Placement Selection:** Choose the most economical placement option.
- **Delivery Window and Transportation Carrier Selection:** Choose a delivery window, then select a non-partnered
  carrier for small parcel delivery.
- **Shipping Details and Labels:** Provide comprehensive shipping details and generate FBA box labels.
- **Update Tracking:** Update Amazon with the tracking information provided by your carrier for seamless tracking and
  management.

## Getting Started

To effectively implement the Fulfillment Inbound v2024 API and leverage the sample solution app:

1. **Choose Your Workflow:**

   Decide whether you want to use Amazon’s partnered carriers or your own non-partnered carriers based on your business needs.

2. **Code Setup and Deployment Details:**

   Based on your chosen workflow, navigate to the respective folders within the sample solution repository to access detailed code setup instructions and deployment guidelines.

    - [Small_Parcel_Delivery_with_Amazon_Partnered_Carrier](https://github.com/amzn/selling-partner-api-samples/tree/main/use-cases/fulfillment-inbound/Small_Parcel_Delivery_with_Amazon_Partnered_Carrier)
    - [Small_Parcel_Delivery_with_Non_Partnered_Carrier](https://github.com/amzn/selling-partner-api-samples/tree/main/use-cases/fulfillment-inbound/Small_Parcel_Delivery_with_Non_Partnered_Carrier)
