import logging
import os

from src.utils import constants
from src.utils.api_utils import ApiUtils
from src.utils.pricing_utils import PricingOfferLambdaInput, camel_to_snake_case_dict

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"FetchPrice Lambda input: {event}")

    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)

    try:
        # Instantiate PricingOfferLambdaInput object from the input event
        pricing_offer_input = PricingOfferLambdaInput(**event)

        # Create an instance of the ApiUtils class for calling the Pricing API
        api_utils = ApiUtils(pricing_offer_input.credentials.refreshToken,
                             region_code,
                             constants.PRICING_API_TYPE)

        # Prepare request content - a list of SKUs
        sku_list = {
            'skus': [pricing_offer_input.itemSku]
        }

        # Call the pricing API to get pricing information for the specified SKU
        get_pricing_response = api_utils.call_pricing_api(method='get_pricing',
                                                          marketplace_id=pricing_offer_input.credentials.marketplaceId,
                                                          item_type="Sku", **sku_list)

        logger.info(f"Pricing API Response: {get_pricing_response}")

        # Check for a client error response from the pricing API
        if get_pricing_response.payload[0]["status"] == "ClientError":
            # Return placeholders for listing and shipping price
            logger.info("ClientError received from Pricing API.")
            return {
                "listingPrice": {
                    "amount": -1
                },
                "shippingPrice": {
                    "amount": -1
                },
                "issues": "ClientError received from Pricing API"
            }

        # Extract pricing data from the API response
        pricing_payload = get_pricing_response.payload[0]
        offer_data = pricing_payload['Product']['Offers'][0]['BuyingPrice']

        # Extract listing and shipping prices from the offer data
        listing_price = camel_to_snake_case_dict(offer_data['LandedPrice'])
        shipping_price = camel_to_snake_case_dict(offer_data['Shipping'])

        # Prepare and return the result containing listing and shipping prices
        result = {
            "listingPrice": listing_price,
            "shippingPrice": shipping_price,
        }
        return result
    except Exception as e:
        # Raise an exception if there's an error during the process
        raise Exception("Calling Pricing API failed", e)