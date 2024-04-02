import os
import json
import boto3
import logging
from dataclasses import asdict

from src.utils import constants, shipping_preferences
from src.utils.api_utils import ApiUtils
from src.utils.shipping_utils import ShippingLambdaInput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"EligibleShipment Lambda input: {json.dumps(event)}")

    # Extract refresh token from environment variables
    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)

    # Extract region code from environment variables
    refresh_token = os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE)

    try:
        # Instantiate ShippingLambdaInput object from the input event
        one_click_shipping_lambda_input = ShippingLambdaInput(**event)

        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(region_code=region_code,
                             refresh_token=refresh_token,
                             api_type=constants.SHIPPING_API_TYPE)

        # Prepare the one-click shipment request body
        one_click_shipment_request = get_one_click_shipment_request_body(
            mfn_order=one_click_shipping_lambda_input.mfnOrder,
            order_id=one_click_shipping_lambda_input.credentials.orderId)

        logger.info(f"Shipping API - OneClickShipment request: {one_click_shipment_request}")

        one_click_shipment_result = api_utils.call_shipping_api('one_click_shipment',
                                                                body=one_click_shipment_request)

        logger.info(f"Shipping API - OneClickShipment response: {one_click_shipment_result}")

        if one_click_shipment_result.payload:
            # Store ShipmentId in DynamoDB
            # Update this section to match your product's logic
            shipment_id = one_click_shipment_result.payload.shipment_id
            tracking_id = one_click_shipment_result.payload.package_document_details[0]["trackingId"]
            carrier_id = one_click_shipment_result.payload.carrier.id
            store_shipment_information(one_click_shipping_lambda_input.credentials.orderId,
                                       shipment_id, tracking_id, carrier_id)

        # Generating Label format
        label = one_click_shipment_result.payload.package_document_details[0]["packageDocuments"][0]
        result = {
            constants.LABEL_FORMAT_KEY_NAME: label["format"],
            constants.LABEL_DIMENSIONS_KEY_NAME: label["type"],
            constants.LABEL_FILE_CONTENTS_KEY_NAME: label["contents"]
        }
        return result

    except Exception as e:
        raise Exception("One-click shipment operation failed") from e


def store_shipment_information(order_id, shipment_id, tracking_id, carrier_id):
    item = {
        constants.SHIPMENTS_TABLE_HASH_KEY_NAME: {'S': order_id},
        constants.SHIPMENTS_TABLE_SHIPMENT_ID_ATTRIBUTE_NAME: {'S': shipment_id},
        constants.SHIPMENTS_TABLE_TRACKING_ID_ATTRIBUTE_NAME: {'S': tracking_id},
        constants.SHIPMENTS_TABLE_CARRIER_ID_ATTRIBUTE_NAME: {'S': carrier_id},
    }
    put_item_request = {
        'TableName': os.environ.get(constants.SHIPMENTS_TABLE_NAME_ENV_VARIABLE),
        'Item': item
    }
    dynamodb = boto3.client(constants.AWS_DYNAMO_DB_CLIENT_KEY_NAME)
    dynamodb.put_item(**put_item_request)


def get_one_click_shipment_request_body(mfn_order, order_id):
    ship_from_dict = {k: v for k, v in asdict(mfn_order.shipFromAddress).items() if v is not None}
    ship_to_dict = {k: v for k, v in asdict(mfn_order.shipToAddress).items() if v is not None}

    # Prepare items list
    items_list = [{
        "itemValue": asdict(item.value),
        "description": shipping_preferences.ITEM_DESCRIPTION,
        "itemIdentifier": item.orderItemId,
        "quantity": item.quantity,
        "weight": asdict(item.itemWeight)
    } for item in mfn_order.orderItems]

    # Define requested document specification
    requested_document_specification = {
        "format": shipping_preferences.LABEL_FORMAT_PDF,
        "size": shipping_preferences.LABEL_SIZE,
        "needFileJoining": bool(shipping_preferences.REQ_DOC_NEED_JOINING),
        "requestedDocumentTypes": shipping_preferences.REQ_DOCUMENT_TYPES,
        "dpi": shipping_preferences.DPI,
        "pageLayout": shipping_preferences.PAGE_LAYOUT
    }

    # Prepare packages
    package_data = {
        "dimensions": asdict(mfn_order.dimensions),
        "weight": asdict(mfn_order.weight),
        "items": items_list,
        "insuredValue": shipping_preferences.PACKAGES_INSURED_VALUE,
        "packageClientReferenceId": f"Order_{order_id}_Package_1"
    }

    # Prepare request body
    request_body = {
        "shipFrom": ship_from_dict,
        "shipTo": ship_to_dict,
        "packages": [package_data],
        "channelDetails": {
            "channelType": shipping_preferences.CHANNEL_TYPE,
            "amazonOrderDetails": {"orderId": order_id}
        },
        "labelSpecifications": requested_document_specification,
        "serviceSelection": shipping_preferences.SERVICE_SELECTION
    }

    return json.dumps(request_body)