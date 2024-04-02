import logging
import os

from src.utils import constants

from src.utils.api_utils import ApiUtils

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

'''
# Sample event input
{
  "TrackingId": "1Z---",
  "CarrierId": "UPS"
}
'''


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"GetTracking Lambda input: {event}")

    # Extract refresh token from environment variables
    refresh_token = os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE)

    # Extract region code from environment variables
    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)

    # Extract tracking id code from event
    tracking_id = event[constants.LAMBDA_TRACKING_ID_KEY_NAME]

    # Extract carrier id code from event
    carrier_id = event[constants.LAMBDA_CARRIER_ID_KEY_NAME]

    try:
        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(refresh_token=refresh_token,
                             region_code=region_code,
                             api_type=constants.SHIPPING_API_TYPE)

        tracking_shipment_result = api_utils.call_shipping_api('get_tracking', tracking_id=tracking_id,
                                                               carrier_id=carrier_id)

        logger.info(f"Shipping API - GetTracking response: {tracking_shipment_result}")

        return str(tracking_shipment_result.payload)

    except Exception as e:
        raise Exception("Calling Shipping API failed", e)