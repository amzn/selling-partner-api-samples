from api_utils import ApiUtils
from constants import Constants

import os
import boto3
import json
import logging

'''
# Sample event input
{
    "OrderId": "123-1234567-1234567",
    "MarketplaceId": "ATVPDKIKX0DER",
    "Sandbox": "Yes"
}
'''

def lambda_handler(event, context):
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.info('Submit Solicitation handler started')
    logger.info(event)

    # Retrieve order details from the input payload
    amazon_order_id = event.get('OrderId')
    marketplace_id = event.get('MarketplaceId')
    marketplace_ids = [marketplace_id]
    region_code = Constants.MARKETPLACE_ID_TO_REGION_CODE_MAPPING.get(marketplace_id)
    sandbox = event.get('Sandbox', 'No')

    # In this sample solution, the refresh token is retrieved from the Lambda function's environment variables
    # Replace this logic to obtain it from your own datastore based on `seller_id` and `marketplace_id` variables
    refresh_token = os.environ[Constants.REFRESH_TOKEN_ENV_VARIABLE]

    # Define the parameters for the createProductReviewAndSellerFeedbackSolicitation API call
    submit_solicitation_params = {
        'marketplace_ids': marketplace_ids
    }

    # Call the createProductReviewAndSellerFeedbackSolicitation operation
    api_utils = ApiUtils(refresh_token, region_code, 'solicitations', sandbox)
    submit_solicitation_result = api_utils.call_solicitations_api(
        method='create_product_review_and_seller_feedback_solicitation',
        amazon_order_id=amazon_order_id,
        **submit_solicitation_params
    )

    # Validate the response
    if submit_solicitation_result is not None:
        result_body = submit_solicitation_result[0].to_dict()
        result_http_code = submit_solicitation_result[1]
        # If the HTTP code is `201`, the solicitation was successfully created
        if result_http_code == 201:
            logger.info('Solicitation successfully created')
        else:
            logger.info(f'Result HTTP code: {result_http_code}, Result body: {json.dumps(result_body, indent=4)}')

        return result_body
    else:
        logger.info('Error while calling CreateProductReviewAndSellerFeedbackSolicitation')
        return
