import os
import uuid
import json
import boto3
import logging
import re

from src.utils import constants
from src.utils.pricing_utils import camel_to_snake_case_dict

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"ProcessNotification Lambda started {event}")

    # Iterate over SQS messages
    for message in event['Records']:

        body_message = message['body']
        logger.info(f"Received new notification: {body_message}")

        try:
            notification = json.loads(body_message)

            # Skip non-AOC notifications
            notification_type = notification[constants.NOTIFICATION_KEY_NOTIFICATION_TYPE]

            if notification_type != constants.NOTIFICATION_TYPE_AOC:
                logger.warning(f"Notification type {notification_type} skipped")
                continue

            aoc_notification = notification['Payload']['AnyOfferChangedNotification']

            aoc_offer_trigger = aoc_notification[constants.NOTIFICATION_KEY_OFFER_CHANGE_TRIGGER]

            # Only process AOC notification if it is of type 'Internal' or 'FeaturedOffer'
            if (aoc_offer_trigger[constants.NOTIFICATION_KEY_OFFER_CHANGE_TYPE] == "Internal"
                    or aoc_offer_trigger[constants.NOTIFICATION_KEY_OFFER_CHANGE_TYPE] == "FeaturedOffer"):
                logger.info("Starting state machine execution")
                # Start a Step Functions workflow execution for Pricing updates
                execution_arn = start_step_functions_execution(aoc_notification, aoc_offer_trigger)
                logger.info(f"State machine successfully started. Execution arn: {execution_arn}")
            else:
                logger.error(
                    f"Offer Change Type {aoc_offer_trigger[constants.NOTIFICATION_KEY_OFFER_CHANGE_TYPE]} skipped")
        except json.JSONDecodeError as e:
            logger.error(f"Message body could not be mapped to a SP-API Notification: {e}")

    return "Finished processing incoming notifications"


# Function to fetch offers from AOC notifications.
def fetch_offer_from_notifications(aoc_notification):
    selling_partner_offers = []
    offers = aoc_notification[constants.NOTIFICATION_KEY_OFFERS]

    # Loop to append Seller ID offers information
    for offer in offers:
        if offer[constants.NOTIFICATION_KEY_SELLER_ID] == aoc_notification[constants.NOTIFICATION_KEY_SELLER_ID]:
            selling_partner_offers.append({
                constants.STATE_MACHINE_KEY_LISTING_PRICE: camel_to_snake_case_dict(
                    offer[constants.NOTIFICATION_KEY_LISTING_PRICE]),
                constants.STATE_MACHINE_KEY_SHIPPING_PRICE: camel_to_snake_case_dict(
                    offer[constants.NOTIFICATION_KEY_SHIPPING_PRICE]),
                constants.STATE_MACHINE_KEY_IS_BUY_BOX_WINNER: offer[constants.NOTIFICATION_KEY_IS_BUY_BOX_WINNER],
                constants.STATE_MACHINE_KEY_IS_FULFILLED_BY_AMAZON: offer[
                    constants.NOTIFICATION_KEY_IS_FULFILLED_BY_AMAZON]
            })
    return selling_partner_offers


# This function starts a Step Functions workflow execution.
def start_step_functions_execution(aoc_notification, aoc_offer_trigger):
    seller_id = aoc_notification[constants.NOTIFICATION_KEY_SELLER_ID]
    asin = aoc_offer_trigger[constants.NOTIFICATION_KEY_ASIN]
    buy_box_price = aoc_notification[constants.NOTIFICATION_KEY_SUMMARY][constants.NOTIFICATION_KEY_BUY_BOX_PRICES][0][
        constants.NOTIFICATION_KEY_LANDED_PRICE]

    input_payload = {
        constants.STATE_MACHINE_KEY_ASIN: asin,
        constants.STATE_MACHINE_KEY_CREDENTIALS: {
            constants.STATE_MACHINE_KEY_REGION_CODE: constants.MARKETPLACE_ID_TO_REGION_CODE_MAPPING.get(
                aoc_offer_trigger[constants.NOTIFICATION_KEY_MARKETPLACE_ID]),
            constants.STATE_MACHINE_KEY_REFRESH_TOKEN: os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE),
            constants.STATE_MACHINE_KEY_MARKETPLACE_ID: aoc_offer_trigger[constants.NOTIFICATION_KEY_MARKETPLACE_ID]
        },
        constants.STATE_MACHINE_KEY_SELLER_ID: seller_id,
        constants.STATE_MACHINE_KEY_BUY_BOX: {
            constants.STATE_MACHINE_KEY_BUY_BOX_CONDITION:
                aoc_notification[constants.NOTIFICATION_KEY_SUMMARY][constants.NOTIFICATION_KEY_BUY_BOX_PRICES]
                [constants.NOTIFICATION_BUY_BOX_PRICES_ITEM][constants.NOTIFICATION_KEY_ITEM_CONDITION],
            constants.STATE_MACHINE_KEY_BUY_BOX_PRICE: camel_to_snake_case_dict(buy_box_price)
        },
        constants.STATE_MACHINE_KEY_SELLER:
            {
                constants.STATE_MACHINE_KEY_SELLER_ID: seller_id,
                constants.STATE_MACHINE_KEY_OFFERS: fetch_offer_from_notifications(aoc_notification)
            }
    }

    request = {
        'stateMachineArn': os.environ.get(constants.STATE_MACHINE_ARN_ENV_VARIABLE),
        'name': f"{seller_id}-{asin}-{str(uuid.uuid4())}",
        'input': json.dumps(input_payload)
    }

    step_functions = boto3.client(constants.AWS_STEP_FUNCTIONS_CLIENT_NAME)
    result = step_functions.start_execution(**request)

    return result[constants.AWS_STEP_FUNCTIONS_ARN_NAME]
