# Easy Ship Order Processing Recipe

This recipe demonstrates the complete workflow for processing Amazon Easy Ship orders using the External Fulfillment API (also known as SmartConnect API).

## What is Amazon Easy Ship?

Amazon Easy Ship is a fast, affordable and easy delivery service for Amazon sellers. When you choose Amazon Easy Ship, you need to drop off Amazon orders at the nearest eligible drop-off point and the carrier will deliver it to your customer's doorstep. Your customers will get reliable and trackable deliveries.

## What is External Fulfillment API?

The External Fulfillment API (also known as SmartConnect API) allows programmatic handling of inventory, returns, and shipping across multiple external fulfillment channels, including Seller Flex, Easy Ship, Self Ship, and MFN Self Delivery.

## Workflow Steps

The recipe implements a 5-step workflow:

### Step 1: Fetch Open Easy Ship Orders
Retrieves shipments in the specified status (ACCEPTED or CREATED).

**Important:** 
- Use `ACCEPTED` status if inventory was synced using the External Fulfillment Inventory API
- Use `CREATED` status if inventory was pushed via Listings Items API

### Step 2: Acknowledge Order Shipment
Confirms that the seller will fulfill the specified shipment (CONFIRM operation) or reject it (REJECT operation).

### Step 3: Create Shipment Packages
Provides package dimensions, weight, and line items for the shipment.

Example package details:
- Dimensions: 25cm x 20cm x 10cm
- Weight: 1000 grams
- Line items with quantities

### Step 4: Retrieve Shipping Options
Gets the list of available shipping options provided by the marketplace for the package.

### Step 5: Generate Shipping Labels
Generates and retrieves shipping labels for the packages, including tracking information.

**Label Download & Display:**
- Automatically downloads the shipping label from the presigned URL
- Opens image formats (PNG, PDF, JPG) in the default viewer
- Saves ZPL format labels to a temporary file for printing

**Important Notes:**
- **Production labels** are typically in ZPL (Zebra Programming Language) format for thermal printers
- **Mock/test labels** may be in PNG format for easy viewing
- ZPL labels should be sent directly to a ZPL-compatible thermal printer
- The recipe handles both formats automatically

## Usage

```python
from src.recipes.easyship.easyship_order_processing_recipe import EasyShipOrderProcessingRecipe
from spapi.models.external_fulfillment_shipments_v2024_09_11.status import Status

# Create recipe instance
recipe = EasyShipOrderProcessingRecipe(
    marketplace_id="ATVPDKIKX0DER",  # US marketplace
    shipment_status=Status.ACCEPTED  # or Status.CREATED
)

# Run the complete workflow
recipe.start()
```

### Using Model Classes

The recipe uses strongly-typed model classes from the SDK:

```python
from spapi.models.external_fulfillment_shipments_v2024_09_11.package import Package
from spapi.models.external_fulfillment_shipments_v2024_09_11.package_dimensions import PackageDimensions
from spapi.models.external_fulfillment_shipments_v2024_09_11.dimension import Dimension
from spapi.models.external_fulfillment_shipments_v2024_09_11.weight import Weight

# Example: Creating a package with proper models
dimensions = PackageDimensions(
    length=Dimension(dimension_unit="CM", value=25),
    width=Dimension(dimension_unit="CM", value=20),
    height=Dimension(dimension_unit="CM", value=10)
)

weight = Weight(value=1000, weight_unit="grams")

package = Package(
    id="PKG-123",
    dimensions=dimensions,
    weight=weight,
    package_line_items=[...]
)
```

## Configuration

The recipe requires SP-API credentials configured in the `SPAPIConfig`:

```python
from spapi import SPAPIConfig

config = SPAPIConfig(
    client_id="YOUR_LWA_CLIENT_ID",
    client_secret="YOUR_LWA_CLIENT_SECRET",
    refresh_token="YOUR_LWA_REFRESH_TOKEN",
    region="NA",
)

recipe = EasyShipOrderProcessingRecipe(config=config)
```

## Testing

Run the test suite:

```bash
pytest test/easyship/test_easyship_order_processing_recipe.py
```

## API Reference

This recipe uses the following External Fulfillment Shipping API operations:

- `get_shipments()` - Fetch shipments by status
- `update_shipment()` - Confirm or reject a shipment
- `create_packages()` - Define package details
- `get_shipping_options()` - Retrieve available shipping methods
- `generate_and_retrieve_ship_labels()` - Generate shipping labels

## Requirements

- `amzn-sp-api` >= 1.6.0 (includes External Fulfillment API support)
- Valid SP-API credentials with appropriate permissions

## Important Notes from Real-World Usage

### Package Dimensions
The recipe uses recommended package dimensions from the shipment response:
- Length: 28 CM
- Width: 26 CM  
- Height: 10 CM
- Weight: 280 grams

These values come from the `recommendedPackages` field in the shipment data and should be used to ensure compatibility with the carrier's requirements.

### Common Pitfalls
1. **Negative Dimensions**: Ensure all dimension values are positive numbers
2. **Shipment ID**: Must match exactly from Step 1 response (e.g., "U6GsCjSJX")
3. **Package Line Item ID**: Extract from `lineItems[0].shipmentLineItemId` in the shipment response
4. **Shipping Option ID**: Must be URL-encoded when passed as query parameter
5. **Channel Name**: For Easy Ship, typically use "MFN" (Merchant Fulfilled Network)

### API Versioning
Note that the collection shows two different API versions:
- `/externalFulfillment/2024-09-11/shipments` - for retrieving shipments (Step 1)
- `/externalFulfillment/shipments/2021-01-06/shipments` - for processing operations (Steps 2-5)

The Python SDK handles this versioning automatically through the `v2024_09_11` module.

## Related Documentation

- [External Fulfillment Shipping API Documentation](https://developer-docs.amazon.com/sp-api/docs/external-fulfillment-shipping)
- [Amazon Easy Ship Overview](https://sell.amazon.com/programs/easy-ship)
