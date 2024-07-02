import os
import boto3
import logging
from decimal import Decimal

from src.utils import constants
from src.utils.mfn_order import MfnOrder

from src.api_models.mfn_api.swagger_client.models.weight import Weight
from src.api_models.mfn_api.swagger_client.models.unit_of_length import UnitOfLength
from src.api_models.mfn_api.swagger_client.models.unit_of_weight import UnitOfWeight
from src.api_models.mfn_api.swagger_client.models.package_dimensions import PackageDimensions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    logger.info(f"InventoryCheck Lambda input: {event}")

    package_weight_value = 0
    package_weight_unit = ""

    package_length = 0
    package_width = 0
    package_height = 0
    package_size_unit = ""

    mfn_order = MfnOrder.from_dict(event)
    # Iterate over all order items and retrieve stock, size, and weight from the database
    for order_item in mfn_order.orderItems:
        # Retrieve the item from DynamoDB by SKU
        # Update this section to match your product's logic
        key = {constants.INVENTORY_TABLE_HASH_KEY_NAME: {"S": order_item.sku}}

        dynamodb = boto3.client(constants.AWS_DYNAMO_DB_CLIENT_KEY_NAME)
        get_item_result = dynamodb.get_item(TableName=os.environ.get(constants.INVENTORY_TABLE_NAME_ENV_VARIABLE),
                                            Key=key)
        item = get_item_result.get('Item', {})

        stock = int(item.get(constants.INVENTORY_TABLE_STOCK_ATTRIBUTE_NAME, {"N": "0"})["N"])
        if stock < order_item.quantity:
            raise Exception(f"Stock level for SKU {order_item.sku} is not enough to fulfill the requested quantity")

        item_weight_value = int(item.get(constants.INVENTORY_TABLE_WEIGHT_VALUE_ATTRIBUTE_NAME, {"N": "0"})["N"])

        # Valid values for the database records are uppercase: [OZ, G]
        item_weight_unit = item.get(constants.INVENTORY_TABLE_WEIGHT_UNIT_ATTRIBUTE_NAME, {"S": ""})["S"]

        item_length = int(item.get(constants.INVENTORY_TABLE_LENGTH_ATTRIBUTE_NAME, {"N": "0"})["N"])
        item_width = int(item.get(constants.INVENTORY_TABLE_WIDTH_ATTRIBUTE_NAME, {"N": "0"})["N"])
        item_height = int(item.get(constants.INVENTORY_TABLE_HEIGHT_ATTRIBUTE_NAME, {"N": "0"})["N"])

        # Valid values for the database records are uppercase: [INCHES, CENTIMETERS]
        item_size_unit = item.get(constants.INVENTORY_TABLE_SIZE_UNIT_ATTRIBUTE_NAME, {"S": ""})["S"]

        unit_of_weight_enum = UnitOfWeight.G if item_weight_unit == "G" else UnitOfWeight.OZ if item_weight_unit == "OZ" else None
        item_weight = Weight(unit=unit_of_weight_enum, value=Decimal(str(item_weight_value)))

        order_item.itemWeight = item_weight

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

    event_unit_of_weight_enum = UnitOfWeight.G if package_weight_unit == "G" else UnitOfWeight.OZ if package_weight_unit == "OZ" else None
    event_unit_of_length_enum = UnitOfLength.INCHES if package_size_unit == "INCHES" else UnitOfLength.CENTIMETERS if package_size_unit == "CENTIMETERS" else None

    mfn_order.weight = Weight(unit=event_unit_of_weight_enum, value=Decimal(str(package_weight_value)))
    mfn_order.packageDimensions = PackageDimensions(
        length=package_length,
        width=package_width,
        height=package_height,
        unit=event_unit_of_length_enum
    )
    return mfn_order.to_json()
