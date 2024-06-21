import os
import uuid
import json
import boto3
import logging

from src.utils import constants
from src.utils.pricing_utils import camel_to_snake_case_dict, pascal_to_camel_case_dict

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    logger.info(f"ProcessNotification Lambda started {event}")

    for message in event['Records']:
        body_message = message['body']
        logger.info(f"Received new notification: {body_message}")

        try:
            notification = json.loads(body_message)
            notification = pascal_to_camel_case_dict(notification)
            notification_type = notification[constants.NOTIFICATION_KEY_NOTIFICATION_TYPE]

            if notification_type not in [constants.NOTIFICATION_TYPE_AOC, constants.NOTIFICATION_TYPE_PH]:
                logger.warning(f"Notification type {notification_type} skipped")
                continue

            if notification_type == constants.NOTIFICATION_TYPE_AOC:
                process_aoc_notification(notification)
            elif notification_type == constants.NOTIFICATION_TYPE_PH:
                process_ph_notification(notification)

        except json.JSONDecodeError as e:
            logger.error(f"Message body could not be mapped to a SP-API Notification: {e}")

    return "Finished processing incoming notifications"


def process_aoc_notification(notification):
    aoc_notification = notification['payload']['AnyOfferChangedNotification']
    aoc_offer_trigger = aoc_notification[constants.NOTIFICATION_KEY_OFFER_CHANGE_TRIGGER]

    if aoc_offer_trigger[constants.NOTIFICATION_KEY_OFFER_CHANGE_TYPE] in ["Internal", "FeaturedOffer"]:
        logger.info("Starting state machine execution")
        execution_arn = start_step_functions_execution(
            notification=aoc_notification,
            offer_trigger=aoc_offer_trigger,
            notification_type=constants.NOTIFICATION_TYPE_AOC
        )
        logger.info(f"State machine successfully started. Execution arn: {execution_arn}")
    else:
        logger.error(f"Offer Change Type {aoc_offer_trigger[constants.NOTIFICATION_KEY_OFFER_CHANGE_TYPE]} skipped")


def process_ph_notification(notification):
    ph_notification = notification['payload']
    ph_offer_trigger = ph_notification[constants.NOTIFICATION_KEY_PH_OFFER_CHANGE_TRIGGER]
    ph_merchant_offer = ph_notification[constants.NOTIFICATION_KEY_PH_MERCHANT_OFFER]
    logger.info("Starting state machine execution")

    execution_arn = start_step_functions_execution(
        notification=ph_notification,
        offer_trigger=ph_offer_trigger,
        ph_merchant_offer=ph_merchant_offer,
        notification_type=constants.NOTIFICATION_TYPE_PH
    )
    logger.info(f"State machine successfully started. Execution arn: {execution_arn}")


def fetch_offer_from_aoc_notification(notification):
    return [
        {
            constants.STATE_MACHINE_KEY_LISTING_PRICE: camel_to_snake_case_dict(
                offer[constants.NOTIFICATION_KEY_LISTING_PRICE]),
            constants.STATE_MACHINE_KEY_SHIPPING_PRICE: camel_to_snake_case_dict(
                offer[constants.NOTIFICATION_KEY_SHIPPING_PRICE]),
            constants.STATE_MACHINE_KEY_IS_BUY_BOX_WINNER: offer[constants.NOTIFICATION_KEY_IS_BUY_BOX_WINNER],
            constants.STATE_MACHINE_KEY_IS_FULFILLED_BY_AMAZON: offer[constants.NOTIFICATION_KEY_IS_FULFILLED_BY_AMAZON]
        }
        for offer in notification[constants.NOTIFICATION_KEY_OFFERS]
        if offer[constants.NOTIFICATION_KEY_SELLER_ID] == notification[constants.NOTIFICATION_KEY_SELLER_ID]
    ]


def fetch_offer_from_ph_notification(ph_merchant_offer):
    is_fulfilled_by_amazon = ph_merchant_offer["fulfillmentType"] != constants.NOTIFICATION_KEY_PH_MFN_TYPE
    return [{
        "isFulfilledByAmazon": is_fulfilled_by_amazon,
        "isBuyBoxWinner": False,
        "listingPrice": {
            "amount": ph_merchant_offer["listingPrice"]["amount"],
            "currency_code": ph_merchant_offer["listingPrice"]["currencyCode"]
        },
        "shippingPrice": {
            "amount": ph_merchant_offer["shipping"]["amount"],
            "currency_code": ph_merchant_offer["shipping"]["currencyCode"]
        }
    }]


def start_step_functions_execution(notification, offer_trigger, notification_type, ph_merchant_offer=None):
    if notification_type == constants.NOTIFICATION_TYPE_AOC:
        seller_id = notification[constants.NOTIFICATION_KEY_SELLER_ID]
        asin = offer_trigger[constants.NOTIFICATION_KEY_ASIN]
        buy_box_summary = notification[constants.NOTIFICATION_KEY_SUMMARY][constants.NOTIFICATION_KEY_BUY_BOX_PRICES][0]
        buy_box_price = camel_to_snake_case_dict(buy_box_summary[constants.NOTIFICATION_KEY_LANDED_PRICE])
        marketplace_id = offer_trigger[constants.NOTIFICATION_KEY_MARKETPLACE_ID]
        buy_box_condition = buy_box_summary[constants.NOTIFICATION_KEY_ITEM_CONDITION]
        offers = fetch_offer_from_aoc_notification(notification)
    else:
        seller_id = notification[constants.NOTIFICATION_KEY_PH_SELLER_ID]
        asin = offer_trigger[constants.NOTIFICATION_KEY_PH_ASIN]
        buy_box_summary = \
        notification[constants.NOTIFICATION_KEY_PH_SUMMARY][constants.NOTIFICATION_KEY_PH_BUY_BOX_PRICES][0]
        buy_box_price = camel_to_snake_case_dict(buy_box_summary[constants.NOTIFICATION_KEY_PH_LANDED_PRICE])
        marketplace_id = offer_trigger[constants.NOTIFICATION_KEY_PH_MARKETPLACE_ID]
        buy_box_condition = buy_box_summary[constants.NOTIFICATION_KEY_PH_CONDITION]
        offers = fetch_offer_from_ph_notification(ph_merchant_offer)
        reference_price = notification["summary"].get(constants.NOTIFICATION_KEY_PH_REFERENCE_PRICE)
        if reference_price:
            reference_price = convert_reference_price(reference_price)
            offers[0][constants.NOTIFICATION_KEY_PH_REFERENCE_PRICE] = reference_price

    input_payload = {
        constants.STATE_MACHINE_KEY_ASIN: asin,
        constants.STATE_MACHINE_KEY_CREDENTIALS: {
            constants.STATE_MACHINE_KEY_REFRESH_TOKEN: os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE),
            constants.STATE_MACHINE_KEY_REGION_CODE: os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE),
            constants.STATE_MACHINE_KEY_MARKETPLACE_ID: marketplace_id
        },
        constants.STATE_MACHINE_KEY_SELLER_ID: seller_id,
        constants.STATE_MACHINE_KEY_BUY_BOX: {
            constants.STATE_MACHINE_KEY_BUY_BOX_CONDITION: buy_box_condition,
            constants.STATE_MACHINE_KEY_BUY_BOX_PRICE: buy_box_price
        },
        constants.STATE_MACHINE_KEY_SELLER: {
            constants.STATE_MACHINE_KEY_SELLER_ID: seller_id,
            constants.STATE_MACHINE_KEY_OFFERS: offers
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


def convert_reference_price(reference_price):
    for price_type in ["averageSellingPrice", "competitivePriceThreshold", "msrpPrice", "retailOfferPrice"]:
        if price_type in reference_price:
            reference_price[price_type]["currency_code"] = reference_price[price_type].pop("currencyCode")
    return reference_price
