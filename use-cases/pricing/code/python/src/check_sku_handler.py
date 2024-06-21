import logging
from dataclasses import asdict

import boto3
from boto3.dynamodb.conditions import Key, Attr
import os

from src.utils import constants
from src.utils.pricing_utils import PricingOfferLambdaInput, PriceChangeRule, Credentials

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"Check SKU Event Payload {event}")

    # Instantiate PricingOfferLambdaInput object from the input event
    lambda_input = PricingOfferLambdaInput(**event)

    # Create an empty list to append updated offers here
    final_offer_list = []

    # Fetch SKUs from query result
    database_sku_offers = fetch_sku_list_from_db(lambda_input.asin,
                                                 lambda_input.buyBox.condition.lower(),
                                                 lambda_input.seller.sellerId,
                                                 lambda_input.credentials.marketplaceId)

    # Map SKUs from query result with Notification Offers
    for database_offer in database_sku_offers:
        pricing_offer = PricingOfferLambdaInput()

        # Mapping information fetched from DB
        pricing_offer.isFulfilledByAmazon = database_offer[constants.SELLER_TABLE_IS_FULFILLED_BY_AMAZON_KEY_NAME]
        pricing_offer.itemSku = database_offer[constants.SELLER_TABLE_HASH_KEY_NAME]
        pricing_offer.minThreshold = database_offer[constants.SELLER_TABLE_THRESHOLD_KEY_NAME]
        pricing_offer.useCompetitivePrice = database_offer[constants.SELLER_TABLE_USE_COMPETITIVE_PRICE]
        pricing_offer.priceChangeRule = PriceChangeRule(
            value=database_offer[constants.SELLER_TABLE_PRICE_CHANGE_AMOUNT_KEY_NAME],
            rule=database_offer[constants.SELLER_TABLE_PRICE_CHANGE_RULE_KEY_NAME])

        # Mapping information fetched from Notification
        pricing_offer.buyBox = lambda_input.buyBox
        pricing_offer.sellerId = lambda_input.seller.sellerId
        pricing_offer.asin = lambda_input.asin
        pricing_offer.credentials = lambda_input.credentials

        # Matching Notification Offers from notification based on isFBA Attribute
        matching_notification_offer = next((offer for offer in lambda_input.seller.offers
                                            if pricing_offer.isFulfilledByAmazon == offer.isFulfilledByAmazon), None)

        # Map listing and shipping price if mapping was successful
        if matching_notification_offer:
            pricing_offer.sellerOffer = matching_notification_offer

        # Append to general list
        final_offer_list.append(asdict(pricing_offer))

    # Prepare and return the final result containing updated offers
    result = {
        "offers": final_offer_list
    }

    return result


def fetch_sku_list_from_db(asin, condition, seller_id, marketplace_id):
    # Initialize a session using Amazon DynamoDB
    dynamodb = boto3.resource(constants.AWS_DYNAMO_DB_CLIENT_KEY_NAME)

    # Create a DynamoDB table resource
    table = dynamodb.Table(os.environ.get(constants.SELLER_TABLE_NAME_ENV_VARIABLE))

    # Query DynamoDB table based on Filters provided
    response = table.query(
        KeyConditionExpression=Key(constants.SELLER_TABLE_ASIN_KEY_NAME).eq(asin),
        FilterExpression=Attr(constants.SELLER_TABLE_SELLER_ID_KEY_NAME).eq(seller_id)
                         & Attr(constants.SELLER_TABLE_CONDITION_KEY_NAME).eq(condition)
                         & Attr(constants.SELLER_TABLE_MARKETPLACE_KEY_NAME).eq(marketplace_id)
    )

    return response['Items']