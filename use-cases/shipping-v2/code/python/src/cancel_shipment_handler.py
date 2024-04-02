import logging
import os

from src.utils import constants
from src.utils.api_utils import ApiUtils

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

'''
# Sample event input
{
  "ShipmentId": "amzn1.---",
}
'''


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"Cancel Shipment Lambda input: {event}")

    # Extract refresh token from environment variables
    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)

    # Extract region code from environment variables
    refresh_token = os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE)

    # Retrieve request details from the input payload
    shipment_id = event[constants.LAMBDA_SHIPMENT_ID_KEY_NAME]

    try:
        # Initialize ApiUtils instance
        api_utils = ApiUtils(refresh_token=refresh_token, region_code=region_code, api_type=constants.SHIPPING_API_TYPE)

        # Call the cancel_shipment API
        cancel_shipment_result = api_utils.call_shipping_api(method='cancel_shipment', body=shipment_id)

        logger.info(f"Shipping API - CancelShipment response: {cancel_shipment_result}")

        return "Cancel Shipment Succeeded! - " + str(cancel_shipment_result.payload)

    except Exception as e:
        logger.error(f"Exception occurred: {str(e)}")
        raise Exception("Calling Shipping API failed") from e
