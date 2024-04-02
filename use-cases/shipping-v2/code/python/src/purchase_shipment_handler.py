import os
import json
import boto3
import logging

from src.utils import constants
from src.utils import shipping_preferences

from src.utils.api_utils import ApiUtils
from src.utils.shipping_utils import ShippingLambdaInput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"PurchaseShipment Lambda input: {event}")

    # Extract refresh token from environment variables
    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)

    # Extract region code from environment variables
    refresh_token = os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE)

    try:
        purchase_shipment_lambda_input = ShippingLambdaInput(**event)

        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(region_code=region_code,
                             refresh_token=refresh_token,
                             api_type=constants.SHIPPING_API_TYPE)

        # Create shipment for the selected shipping service
        purchase_shipment_request = get_purchase_shipment_request_body(payload=purchase_shipment_lambda_input)

        logger.info(f"Shipping API - PurchaseShipment request: {purchase_shipment_request}")

        purchase_shipment_result = api_utils.call_shipping_api('purchase_shipment', body=purchase_shipment_request)

        logger.info(f"Shipping API - PurchaseShipment response: {purchase_shipment_result}")

        # Store ShipmentId in DynamoDB
        # Update this section to match your product's logic
        shipment_id = purchase_shipment_result.payload.shipment_id
        tracking_id = purchase_shipment_result.payload.package_document_details[0]["trackingId"]
        carrier_id = purchase_shipment_lambda_input.rates.preferredRate.carrierId
        store_shipment_information(purchase_shipment_lambda_input.credentials.orderId,
                                   shipment_id, tracking_id, carrier_id)

        # Generating Label format
        label = purchase_shipment_result.payload.package_document_details[0]["packageDocuments"][0]
        result = {
            constants.LABEL_FORMAT_KEY_NAME: label["format"],
            constants.LABEL_DIMENSIONS_KEY_NAME: label["type"],
            constants.LABEL_FILE_CONTENTS_KEY_NAME: label["contents"]
        }
        return result

    except Exception as e:
        raise Exception("Calling Shipping API failed", e)


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


def get_purchase_shipment_request_body(payload):
    supported_specs = payload.rates.preferredRate.supportedDocumentSpecifications[0]
    print_options = supported_specs.printOptions[0]
    page_layout = print_options["supportedPageLayouts"][0]
    document_types = [type_detail["name"] for type_detail in print_options["supportedDocumentDetails"] if
                      type_detail["isMandatory"]]
    needs_file_joining = bool(print_options['supportedFileJoiningOptions'][0])
    additionalInput = payload.rates.preferredRate.additionalInput

    requested_document_specification = {
        "format": supported_specs.format,
        "size": supported_specs.size,
        "needFileJoining": needs_file_joining,
        "pageLayout": page_layout,
        "requestedDocumentTypes": document_types
    }

    request = {
        "requestToken": payload.rates.requestToken,
        "rateId": payload.rates.preferredRate.rateId,
        "requestedDocumentSpecification": requested_document_specification,
        "additionalInputs": additionalInput,
        "requestedValueAddedServices": [{
                "id": shipping_preferences.VALUE_ADDED_SERVICE
        }]
    }

    return json.dumps(request)
