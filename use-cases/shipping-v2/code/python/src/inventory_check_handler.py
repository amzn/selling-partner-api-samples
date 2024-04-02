import os
import boto3
import logging
from dataclasses import asdict
from src.utils import constants
from src.utils.shipping_utils import ShippingLambdaInput, Weight, Dimensions

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"InventoryCheck Lambda input: {event}")

    # Initialize package weight and dimensions
    package_weight_value = 0
    package_weight_unit = "LB"

    package_length = 0
    package_width = 0
    package_height = 0
    package_size_unit = "GM"

    get_order_lambda_input = ShippingLambdaInput(**event)

    # Check if mfnOrder is not None
    if get_order_lambda_input.mfnOrder:
        # Check if orderItems is not None
        if get_order_lambda_input.mfnOrder.orderItems:
            # Iterate over all order items and retrieve stock, size, and weight from the database
            for order_item in get_order_lambda_input.mfnOrder.orderItems:
                # Retrieve the item from DynamoDB by SKU
                # Update this section to match your product's logic
                key = {constants.INVENTORY_TABLE_HASH_KEY_NAME: {"S": order_item.sku}}

                dynamodb = boto3.client(constants.AWS_DYNAMO_DB_CLIENT_KEY_NAME)
                get_item_result = dynamodb.get_item(TableName=os.environ.get(constants.INVENTORY_TABLE_NAME_ENV_VARIABLE),
                                                    Key=key)
                item = get_item_result.get("Item", {})

                stock = int(item.get(constants.INVENTORY_TABLE_STOCK_ATTRIBUTE_NAME, {"N": "0"})["N"])
                if stock < order_item.quantity:
                    raise Exception(f"Stock level for SKU {order_item.sku} "
                                    f"is not enough to fulfill the requested quantity")

                item_weight_value = int(item.get(constants.INVENTORY_TABLE_WEIGHT_VALUE_ATTRIBUTE_NAME, {"N": "0"})["N"])

                # Valid values for the database records are uppercase: [OZ, G]
                item_weight_unit = item.get(constants.INVENTORY_TABLE_WEIGHT_UNIT_ATTRIBUTE_NAME, {"S": ""})["S"]

                item_length = int(item.get(constants.INVENTORY_TABLE_LENGTH_ATTRIBUTE_NAME, {"N": "0"})["N"])
                item_width = int(item.get(constants.INVENTORY_TABLE_WIDTH_ATTRIBUTE_NAME, {"N": "0"})["N"])
                item_height = int(item.get(constants.INVENTORY_TABLE_HEIGHT_ATTRIBUTE_NAME, {"N": "0"})["N"])

                # Valid values for the database records are uppercase: [INCHES, CENTIMETERS]
                item_size_unit = item.get(constants.INVENTORY_TABLE_SIZE_UNIT_ATTRIBUTE_NAME, {"S": ""})["S"]

                # Create a Dimensions object for the item weight
                item_dimensions = Dimensions(unit=item_size_unit, length=item_length, width=item_width,
                                             height=item_height)

                # Create a Weight object for the item weight
                item_weight = Weight(unit=item_weight_unit, value=float(str(item_weight_value)))

                # Update the order item with the retrieved weight
                order_item.itemWeight = item_weight
                order_item.dimensions = item_dimensions

                # Package weight is calculated by adding the individual weights
                # Update this section to match your selling partners' logic
                package_weight_value += item_weight_value
                package_weight_unit = item_weight_unit

                # Package size is calculated by adding the individual sizes
                # Update this section to match your selling partners' logic
                package_length += item_length
                package_width += item_width
                package_height += item_height
                package_size_unit = item_size_unit

            get_order_lambda_input.mfnOrder.weight = Weight(unit=package_weight_unit,
                                                            value=float(str(package_weight_value)))

            get_order_lambda_input.mfnOrder.dimensions = Dimensions(length=package_length, width=package_width,
                                                                    height=package_height, unit=package_size_unit)
            
    return asdict(get_order_lambda_input)
