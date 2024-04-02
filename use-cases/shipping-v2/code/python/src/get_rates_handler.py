import json
import logging
from dataclasses import asdict
import os

from src.utils import constants, shipping_preferences
from src.utils.api_utils import ApiUtils
from src.utils.shipping_utils import ShippingLambdaInput, Rates

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
        # Instantiate MfnOrder object from the input event
        get_rates_lambda_input = ShippingLambdaInput(**event)

        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(region_code=region_code,
                             refresh_token=refresh_token,
                             api_type=constants.SHIPPING_API_TYPE)

        # Get eligible shipment services for the order
        get_rates_request = get_rates_request_body(mfn_order=get_rates_lambda_input.mfnOrder,
                                                   order_id=get_rates_lambda_input.credentials.orderId)

        logger.info(f"Shipping API - GetRates request: {get_rates_request}")

        get_rates_response = api_utils.call_shipping_api('get_rates', body=json.dumps(get_rates_request))

        if get_rates_response and hasattr(get_rates_response, 'payload') and get_rates_response.payload:
            get_rates_lambda_input.rates = Rates()
            get_rates_lambda_input.rates.requestToken = get_rates_response.payload.request_token
            get_rates_lambda_input.rates = get_rates_response.payload.rates
        else:
            error_msg = "No rates found in the response"
            logger.error(error_msg)
            raise Exception(error_msg)

        return get_rates_response.payload.to_dict()

    except Exception as e:
        logger.error(f"Exception occurred: {str(e)}")
        raise Exception("Calling Shipping API failed") from e


def get_rates_request_body(mfn_order, order_id):
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
        "printOptions": shipping_preferences.PRINT_OPTIONS
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
        "shipFrom": asdict(mfn_order.shipFromAddress),
        "shipTo": asdict(mfn_order.shipToAddress),
        "returnTo": mfn_order.returnToAddress if getattr(mfn_order, 'returnToAddress', None) else None,
        "packages": [package_data],
        "channelDetails": {
            "channelType": shipping_preferences.CHANNEL_TYPE,
            "amazonOrderDetails": {"orderId": order_id}
        },
        "labelSpecifications": requested_document_specification,
        "shipmentType": shipping_preferences.SHIPMENT_TYPE,
        "serviceSelection": shipping_preferences.SERVICE_SELECTION
    }

    return request_body
