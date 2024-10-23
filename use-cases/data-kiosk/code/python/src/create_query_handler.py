import logging
import os

from utils.api_utils import ApiUtils
from utils import constants

logger = logging.getLogger()
logger.setLevel(logging.INFO)

"""
{
  "Query": "query MyQuery{analytics_salesAndTraffic_2023_11_15{salesAndTrafficByAsin...",
}
"""


def lambda_handler(event, context):
    # Retrieve request details from the input payload
    query_code = event[constants.QUERY_CODE_KEY_NAME]
    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)
    refresh_token = os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE)

    # Log the input event for the Lambda
    logger.info(f"CreateQuery Lambda input: {event}")

    try:
        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(refresh_token, region_code, constants.DATA_KIOSK_API_TYPE)

        # Build the createQuery request using the query from the input payload
        body = {
            "query": query_code
        }

        # Call the create_query endpoint to create the query
        create_query_result = api_utils.call_datakiosk_api('create_query', body=body)

        logger.info(f"CreateQuery API Response: {create_query_result}")

        return create_query_result.to_dict()

    except Exception as e:
        raise Exception("Calling Data Kiosk API failed", e.__dict__)
