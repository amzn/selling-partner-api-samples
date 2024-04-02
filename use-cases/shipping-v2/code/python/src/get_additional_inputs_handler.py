import logging
import os

from src.utils import constants
from src.utils.api_utils import ApiUtils
from src.utils.shipping_utils import ShippingLambdaInput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"Get Additional Inputs input: {event}")

    # Extract refresh token from environment variables
    refresh_token = os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE)

    # Extract region code from environment variables
    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)

    try:

        # Instantiate ShippingLambdaInput object from the input event
        get_additional_inputs_input = ShippingLambdaInput(**event)

        request_token = get_additional_inputs_input.rates.requestToken

        rate_id = get_additional_inputs_input.rates.preferredRate.rateId

        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(region_code=region_code,
                             refresh_token=refresh_token,
                             api_type=constants.SHIPPING_API_TYPE)

        get_additional_inputs_response = api_utils.call_shipping_api(method='get_additional_inputs',
                                                                     request_token=request_token,
                                                                     rate_id=rate_id)

        logger.info(f"Shipping API - GetAdditionalInputs response: {get_additional_inputs_response}")

        if get_additional_inputs_response:
            logger.info("GetAdditionalInputs API call successful")
        else:
            logger.error("Failed to fetch additional inputs")
            raise Exception("GetAdditionalInputs API call failed")

        return get_additional_inputs_response.payload

    except Exception as e:
        logger.error(f"Exception occurred: {str(e)}")
        raise Exception("Calling Shipping API failed") from e