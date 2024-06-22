from api_utils import ApiUtils
from constants import Constants

import os
import boto3
import json
import logging

scheduler = boto3.client('scheduler')

'''
# Sample event input
{
    "OrderId": "123-1234567-1234567",
    "MarketplaceId": "ATVPDKIKX0DER",
    "ScheduleName": "event-bridge-schedule-name-123",
    "Sandbox": "Yes"
}
'''

def lambda_handler(event, context):
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.info('Get Solicitation Actions handler started')
    logger.info(event)

    # Delete EventBridge schedule
    schedule_name = event.get('ScheduleName')
    try:
        scheduler.delete_schedule(Name=schedule_name)
        logger.info('Schedule successfully deleted')
    except scheduler.exceptions.ResourceNotFoundException:
        logger.info('Schedule does not exist')

    # Retrieve order details from the input payload
    amazon_order_id = event.get('OrderId')
    marketplace_id = event.get('MarketplaceId')
    marketplace_ids = [marketplace_id]
    region_code = Constants.MARKETPLACE_ID_TO_REGION_CODE_MAPPING.get(marketplace_id)
    sandbox = event.get('Sandbox', 'No')

    # In this sample solution, the refresh token is retrieved from the Lambda function's environment variables
    # Replace this logic to obtain it from your own datastore based on `seller_id` and `marketplace_id` variables
    refresh_token = os.environ[Constants.REFRESH_TOKEN_ENV_VARIABLE]

    # Define the parameters for the getSolicitationActionsForOrder API call
    get_solicitation_actions_for_order_params = {
        'marketplace_ids': marketplace_ids
    }

    # Call the getSolicitationActionsForOrder operation
    api_utils = ApiUtils(refresh_token, region_code, 'solicitations', sandbox)
    get_solicitation_actions_for_order_result = api_utils.call_solicitations_api(
        method='get_solicitation_actions_for_order',
        amazon_order_id=amazon_order_id,
        **get_solicitation_actions_for_order_params
    )

    # Validate the response
    if get_solicitation_actions_for_order_result is not None:
        solicitation_actions_dict = get_solicitation_actions_for_order_result.to_dict()
        logger.info(f'GetSolicitationActionsForOrder result: {json.dumps(solicitation_actions_dict, indent=4)}')

        solicitation_actions_links = solicitation_actions_dict.get('links')
        # If `links` attribute is not empty, there are valid actions to execute on the order
        if solicitation_actions_links:
            for action in solicitation_actions_links.get('actions'):
                action_name = action.get('name')
                action_href = action.get('href')
                # If action name is `productReviewAndSellerFeedback`, a solicitation can be sent to the buyer
                if action_name == Constants.ACTION_PRODUCT_REVIEW_SELLER_FEEDBACK:
                    return {
                        'ActionName': action_name,
                        'ActionHref': action_href
                    }
    else:
        logger.info('Error while calling GetSolicitationActionsForOrder')

    return
