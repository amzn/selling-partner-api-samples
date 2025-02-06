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
- [Fulfillment Inbound API v2024-03-20 Code Samples](https://developer-docs.amazon.com/sp-api/docs/fulfillment-inbound-api-v2024-03-20-code-samples):
  Postman Collections and Code samples to aid with integration to the Fulfillment Inbound API v 2024-03-20.

## Sample Solution

The FBA Inbound Sample Solution App provides all required resources to deploy a fully functional SP-API application that
implements the new **Fulfillment By Amazon (FBA) Inbound API v2024-03-20**. It demonstrates end-to-end implementation
of two business use-cases:

- [Small Parcel Delivery (SPD) with Amazon Partnered Carrier (PCP)](https://github.com/amzn/selling-partner-api-samples/tree/main/use-cases/fulfillment-inbound/Small_Parcel_Delivery_with_Amazon_Partnered_Carrier)
- [Small Parcel Delivery (SPD) with Non-Partnered Carrier (nPCP)](https://github.com/amzn/selling-partner-api-samples/tree/main/use-cases/fulfillment-inbound/Small_Parcel_Delivery_with_Non_Partnered_Carrier)
- [Pallet Delivery (LTL/FTL) with Pack Later Flow (Carton Unknown Upfront)](https://github.com/amzn/selling-partner-api-samples/tree/main/use-cases/fulfillment-inbound/Pack_Later_Flow_Carton_Unknown)

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

### 3. Pallet Delivery (LTL/FTL) with Pack Later Flow (Carton Unknown Upfront):

This workflow is suited for businesses that doesn't know their carton information upfront and want to ship pallets using their own transportation carriers. The workflow includes:

- **Inbound Plan Creation:** Similar to the Small Parcel workflows, create inbound plans with defined SKU items.
- **Placement Selection:** Generate, list and choose the cheapest placement option.
- **Packing Selection:** Provide information related to what items will be packed into boxes per shipment.
- **Delivery Window and Transportation Carrier Selection:** Choose a delivery window, then select a non-partnered
  carrier for pallet (LTL/FTL) delivery.
- **Shipping Details and Labels:** Provide comprehensive shipping details and generate FBA box/pallet labels.
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
    - [Pallet Delivery (LTL/FTL) with Pack Later Flow (Carton Unknown Upfront)](https://github.com/amzn/selling-partner-api-samples/tree/main/use-cases/fulfillment-inbound/Pack_Later_Flow_Carton_Unknown)

## Postman Collections

To help test operations, you can use [Postman collections](https://documenter.getpostman.com/view/39510786/2sAYQWKDdW). These Postman collections include requests and responses that you can use to experiment with various endpoints and functionalities.

- [Small Parcel Delivery (SPD) with an Amazon-partnered carrier (PCP)](https://documenter.getpostman.com/view/39505772/2sAYQWKDdU)
- [Small Parcel Delivery (SPD) with a non-partnered carrier (nPCP)](https://documenter.getpostman.com/view/39505772/2sAYQWKDdV)
- [Pallets (LTL/FTL) with an Amazon-partnered carrier (PCP)](https://documenter.getpostman.com/view/39505772/2sAYQWKDdS)
- [Pallets (LTL/FTL) with non-partnered carriers (nPCP)](https://documenter.getpostman.com/view/39505772/2sAYQWKDdT)
- [Pallet deliveries with the Pack Later option](https://documenter.getpostman.com/view/39505772/2sAYQWKDdR)
- [Retrieve inbound plan details](https://documenter.getpostman.com/view/39505772/2sAYQWKDZ9)


