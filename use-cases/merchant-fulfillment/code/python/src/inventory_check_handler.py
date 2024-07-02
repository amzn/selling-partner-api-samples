from collections import defaultdict
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


def get_item_from_dynamodb(sku):
    dynamodb = boto3.client(constants.AWS_DYNAMO_DB_CLIENT_KEY_NAME)
    key = {constants.INVENTORY_TABLE_HASH_KEY_NAME: {"S": sku}}
    response = dynamodb.get_item(
        TableName=os.environ.get(constants.INVENTORY_TABLE_NAME_ENV_VARIABLE), Key=key
    )
    return response.get("Item", {})


def check_stock_and_update_order(order_item, item):
    stock = int(
        item.get(constants.INVENTORY_TABLE_STOCK_ATTRIBUTE_NAME, {"N": "0"})["N"]
    )
    if stock < order_item.quantity:
        raise Exception(
            f"Stock level for SKU {order_item.sku} is not enough to fulfill the requested quantity"
        )
    order_item.itemWeight = parse_weight(item)


def parse_weight(item):
    weight_value = int(
        item.get(constants.INVENTORY_TABLE_WEIGHT_VALUE_ATTRIBUTE_NAME, {"N": "0"})["N"]
    )
    weight_unit = item.get(
        constants.INVENTORY_TABLE_WEIGHT_UNIT_ATTRIBUTE_NAME, {"S": ""}
    )["S"]
    unit_enum = (
        UnitOfWeight.G
        if weight_unit == "G"
        else UnitOfWeight.OZ
        if weight_unit == "OZ"
        else None
    )
    return Weight(unit=unit_enum, value=Decimal(str(weight_value)))


def calculate_package_dimensions(order_items):
    dimensions = {"length": 0, "width": 0, "height": 0}
    units = defaultdict(int)
    for item in order_items:
        dimensions["length"] += int(
            item.get(constants.INVENTORY_TABLE_LENGTH_ATTRIBUTE_NAME, {"N": "0"})["N"]
        )
        dimensions["width"] += int(
            item.get(constants.INVENTORY_TABLE_WIDTH_ATTRIBUTE_NAME, {"N": "0"})["N"]
        )
        dimensions["height"] += int(
            item.get(constants.INVENTORY_TABLE_HEIGHT_ATTRIBUTE_NAME, {"N": "0"})["N"]
        )
        item_size_unit = item.get(
            constants.INVENTORY_TABLE_SIZE_UNIT_ATTRIBUTE_NAME, {"S": ""}
        )["S"]
        units[item_size_unit] += 1

    # Determine the most common unit of measurement
    unit_of_length_enum = max(units, key=units.get)
    return PackageDimensions(
        length=dimensions["length"],
        width=dimensions["width"],
        height=dimensions["height"],
        unit=getattr(UnitOfLength, unit_of_length_enum),
    )


def lambda_handler(event, context):
    logger.info(f"InventoryCheck Lambda input: {event}")

    mfn_order = MfnOrder.from_dict(event)
    for order_item in mfn_order.orderItems:
        item = get_item_from_dynamodb(order_item.sku)
        check_stock_and_update_order(order_item, item)

    package_dimensions = calculate_package_dimensions(
        [item.to_json() for item in mfn_order.orderItems]
    )
    mfn_order.packageDimensions = package_dimensions

    return mfn_order.to_json()
