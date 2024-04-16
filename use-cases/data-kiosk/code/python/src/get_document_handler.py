import logging
import os

from src.utils import constants
from src.utils.api_utils import ApiUtils
from src.utils.query_utils import DataKioskLambdaInput

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"GetDocument Lambda input: {event}")

    try:
        # Instantiate DataKioskLambdaInput object from the input event
        dk_lambda_input = DataKioskLambdaInput(**event)

        region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)
        refresh_token = os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE)

        # Create an instance of the ApiUtils class for calling the DataKiosk API
        api_utils = ApiUtils(refresh_token, region_code, constants.DATA_KIOSK_API_TYPE)

        # Call the Data Kiosk API to get document information for the specified query
        get_document_response = api_utils.call_datakiosk_api(method='get_document',
                                                             document_id=dk_lambda_input.document.documentId)

        logger.info(f"Data Kiosk API Response: {get_document_response}")

        # If the response is empty, there is no data available for the given time range
        issues_str = "" if get_document_response else (f"DOCUMENT IS EMPTY, "
                                                       f"NO DATA IS AVAILABLE FOR THE GIVEN TIME RANGE")

        result = {
            "documentId": get_document_response.document_id if get_document_response else None,
            "documentUrl": get_document_response.document_url if get_document_response else None,
            "issues": issues_str
        }

        return result
    except Exception as e:
        # Raise an exception if there's an error during the process
        raise Exception("Calling Data Kiosk API failed", e.__dict__)
