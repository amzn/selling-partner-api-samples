import os
import json
import boto3
import logging

from src.utils import constants
from src.utils import mfn_utils
from src.utils.api_utils import ApiUtils

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    # Extract refresh token from event
    refresh_token = event[constants.STATE_MACHINE_REFRESH_TOKEN_KEY_NAME]

    # Extract region code from event
    region_code = event[constants.STATE_MACHINE_REGION_CODE_KEY_NAME]

    # Extract order ID from event
    order_id = event[constants.STATE_MACHINE_ORDER_ID_KEY_NAME]

    logger.info(f"CreateShipment Lambda input: {event}")

    try:
        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(refresh_token, region_code, constants.MFN_API_TYPE)

        # Create shipment for the selected shipping service
        create_shipment_request = get_create_shipment_request_body(payload=event[constants.MFN_ORDER_KEY_NAME], order_id=order_id)

        logger.info(f"Merchant Fulfillment API - CreateShipment request: {create_shipment_request}")

        create_shipment_result = api_utils.call_mfn_api('create_shipment', body=create_shipment_request)

        logger.info(f"Merchant Fulfillment API - CreateShipment response: {create_shipment_result}")

        # Store ShipmentId in DynamoDB
        # Update this section to match your product's logic
        shipment_id = create_shipment_result.payload.shipment_id
        store_shipment_information(order_id, shipment_id)

        # Generating Label format
        label = create_shipment_result.payload.label
        result = {
            constants.LABEL_FORMAT_KEY_NAME: label.label_format,
            constants.LABEL_DIMENSIONS_KEY_NAME: label.dimensions.to_dict(),
            constants.LABEL_FILE_CONTENTS_KEY_NAME: label.file_contents.to_dict()
        }

        return result

    except Exception as e:
        raise Exception("Calling Merchant Fulfillment API failed", e)


def store_shipment_information(order_id, shipment_id):
    item = {
        constants.SHIPMENTS_TABLE_HASH_KEY_NAME: {'S': order_id},
        constants.SHIPMENTS_TABLE_SHIPMENT_ID_ATTRIBUTE_NAME: {'S': shipment_id}
    }

    put_item_request = {
        'TableName': os.environ.get(constants.SHIPMENTS_TABLE_NAME_ENV_VARIABLE),
        'Item': item
    }

    dynamodb = boto3.client(constants.AWS_DYNAMO_DB_CLIENT_KEY_NAME)
    dynamodb.put_item(**put_item_request)


def get_create_shipment_request_body(payload, order_id):
    order_item_list = json.loads(mfn_utils.transform_keys_to_uppercase_first_letter(json.dumps([item for item in payload["orderItems"]])))
    ship_from_address = json.loads(mfn_utils.snake_to_pascal_case(json.dumps(payload["shipFromAddress"])))
    package_dimensions = json.loads(mfn_utils.snake_to_pascal_case(json.dumps(payload["packageDimensions"])))
    weight = json.loads(mfn_utils.snake_to_pascal_case(json.dumps(payload["weight"])))

    shipping_service_options = payload["preferredShippingService"]["ShippingServiceOptions"]
    shipping_service_id = payload["preferredShippingService"]["ShippingServiceId"]
    shipping_service_offer_id = payload["preferredShippingService"]["ShippingServiceOfferId"]

    request = {
        "ShipmentRequestDetails": {
            "AmazonOrderId": order_id,
            "ItemList": order_item_list,
            "ShipFromAddress": ship_from_address,
            "PackageDimensions": package_dimensions,
            "Weight": weight,
            "ShippingServiceOptions": shipping_service_options
        },
        "ShippingServiceId": shipping_service_id,
        "ShippingServiceOfferId": shipping_service_offer_id
    }

    return json.dumps(request)
