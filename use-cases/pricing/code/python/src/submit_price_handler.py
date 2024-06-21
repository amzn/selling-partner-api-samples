import os
import logging

from src.utils import constants
from src.utils.api_utils import ApiUtils
from src.utils.pricing_utils import PricingOfferLambdaInput

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    # Extract region code from lambda environment variables
    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)

    # Log the input event for the Lambda
    logger.info(f"SubmitPrice Lambda input: {event}")

    try:
        # Instantiate PricingOfferLambdaInput object from the input event
        pricing_offer = PricingOfferLambdaInput(**event)

        # Create an instance of the ApiUtils class for interacting with the Listings API
        api_utils = ApiUtils(pricing_offer.credentials.refreshToken,
                             region_code,
                             constants.LISTINGS_API_TYPE)

        # Prepare data and call the Listings API to retrieve specific item details
        marketplace_ids = [pricing_offer.credentials.marketplaceId]

        params = {
            'issue_locale': 'en_US',
            'included_data': ['attributes']
        }

        # Condition to check region code and go to the Sandbox environment
        if region_code in constants.SANDBOX_REGIONS:
            get_listing_response = get_sandbox_listing_response()
        else:
            # Get details of the item from the Listings API
            get_listing_response = api_utils.call_listings_api(method='get_listings_item',
                                                               marketplace_ids=marketplace_ids,
                                                               seller_id=pricing_offer.sellerId,
                                                               sku=pricing_offer.itemSku, **params)
            get_listing_response = get_listing_response.to_dict()
            logger.info(f"Get Listings API Response: {get_listing_response}")

        # Extract purchasable_offer details from the Listings API response
        # Note: we are fetching purchasable offer attribute in order not to override any existing discounts via the patch
        purchasable_offer = get_listing_response['attributes'].get('purchasable_offer')

        # Prepare and send a PATCH request to update item details in the Listings API
        patch_listings_response = api_utils.call_listings_api(method='patch_listings_item',
                                                              marketplace_ids=marketplace_ids,
                                                              seller_id=pricing_offer.sellerId,
                                                              sku=pricing_offer.itemSku,
                                                              body=get_patch_listings_body(
                                                                  new_listing_price=pricing_offer.newListingPrice,
                                                                  purchasable_offer=purchasable_offer))

        # Log the Listings API response
        logger.info(f"Listings API Response: {patch_listings_response}")

        return f"Finished submitting price update. New price is {pricing_offer.newListingPrice}"
    except Exception as e:
        # Raise an exception if there's an error during the process
        raise Exception("Calling Listings API failed", e)


def get_patch_listings_body(new_listing_price, purchasable_offer):
    # Determine the value_with_tax based on the type of new_listing_price (if fetched from Pricing or Notification)
    value_with_tax = new_listing_price.amount

    # Set the value_with_tax in the Listings API PATCH request body
    purchasable_offer[0]['our_price'][0]['schedule'][0]['value_with_tax'] = value_with_tax

    # Construct and return the body for the Listings API PATCH request
    body = {
        "productType": "PRODUCT",
        "patches": [
            {
                "op": "replace",
                "path": "/attributes/purchasable_offer",
                "value": purchasable_offer
            }
        ]
    }

    return body


def get_sandbox_listing_response():
    # Construct and return a mock Item object for Sandbox Listings API get request
    attributes = {
        "attributes": {
            "purchasable_offer": [
                {
                    "our_price": [
                        {
                            "schedule": [
                                {
                                    "value_with_tax": 10
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }

    return attributes
