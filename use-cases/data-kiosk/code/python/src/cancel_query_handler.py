import logging
import os

from src.utils.api_utils import ApiUtils
from src.utils import constants

logger = logging.getLogger()
logger.setLevel(logging.INFO)

"""
{
  "QueryId": "1231413413531"
}
"""


def lambda_handler(event, context):
    # Retrieve request details from the input payload
    query_id = event[constants.QUERY_ID_KEY_NAME]
    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)
    refresh_token = os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE)

    # Log the input event for the Lambda
    logger.info(f"CancelQuery Lambda input: {event}")

    try:
        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(refresh_token, region_code, constants.DATA_KIOSK_API_TYPE)

        # Call the cancel_query method to cancel the query
        api_utils.call_datakiosk_api('cancel_query', query_id=query_id)

        return f"Query {query_id} has been canceled successfully!"

    except Exception as e:
        raise Exception("Calling Data Kiosk API failed", e.__dict__)
