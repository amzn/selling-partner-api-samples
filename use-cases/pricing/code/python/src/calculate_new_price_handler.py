import logging
from src.utils.pricing_utils import PricingOfferLambdaInput, Money
from src.utils import constants

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


# Lambda handler function
def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"CalculateNewPrice Lambda input {event}")

    try:
        # Instantiate PricingOfferLambdaInput object from the input event
        pricing_offer = PricingOfferLambdaInput(**event)

        # Calculate the landed price by summing listing price and shipping price
        landed_price = pricing_offer.sellerOffer.listingPrice.amount + pricing_offer.sellerOffer.shippingPrice.amount

        # Check conditions to determine whether to skip new price calculation
        # Check if buy box price is less than the minimum threshold
        if pricing_offer.buyBox.price.amount < pricing_offer.minThreshold:
            # Log and return indicating skipping new price calculation
            logger.info(
                f"Buy Box Price: {pricing_offer.buyBox.price.amount} is less than threshold: "
                f"{pricing_offer.minThreshold}. "
                f"- Skipping new price calculation.")
            return {
                "newListingPrice": {
                    "amount": -1
                },
                "issues": f"Buy Box Price: {pricing_offer.buyBox.price.amount} is less than threshold"
            }

        # Check if buy box price is greater than landed price
        if pricing_offer.buyBox.price.amount > landed_price:
            # Log and return indicating skipping new price calculation
            logger.info(
                f"Landed Price: {landed_price} is already less than Buy Box Price: "
                f"{pricing_offer.buyBox.price.amount}. "
                f"- Skipping new price calculation.")
            return {
                "newListingPrice": {
                    "amount": -1
                },
                "issues": f"Landed Price: {landed_price} is already less than Buy Box Price"
            }

        # Calculate the new item price based on different price change rules (percentage or fixed)
        if pricing_offer.priceChangeRule.rule == constants.PriceChangeRule.PERCENTAGE.value:
            new_item_price = (pricing_offer.buyBox.price.amount -
                              pricing_offer.priceChangeRule.value * pricing_offer.buyBox.price.amount)
        elif pricing_offer.priceChangeRule.rule == constants.PriceChangeRule.FIXED.value:
            new_item_price = pricing_offer.buyBox.price.amount - pricing_offer.priceChangeRule.value
        else:
            # Log and return indicating invalid price change rule
            logger.info(
                f"Price Change Rule: {pricing_offer.priceChangeRule.rule} is Invalid."
                f"- Skipping new price calculation."
                f"- Please change rule to match one of [PERCENTAGE, FIXED]")
            return {
                "newListingPrice": {
                    "amount": -1
                },
                "issues": f"Price Change Rule: {pricing_offer.priceChangeRule.rule} is Invalid."
            }

        # Calculate the new listing price by subtracting shipping price from the new item price
        new_listing_price = new_item_price - pricing_offer.sellerOffer.shippingPrice.amount

        # Check if the new listing price is less than the minimum threshold
        if new_listing_price < pricing_offer.minThreshold:
            # Log and return indicating skipping new price calculation
            logger.info(
                f"New Listings Price: {new_listing_price} is less than threshold: "
                f"{pricing_offer.minThreshold}. "
                f"- Skipping new price calculation.")
            return {
                "newListingPrice": {
                    "amount": -1
                },
                "issues": f"Buy Box Price: {pricing_offer.buyBox.price.amount} is less than threshold"
            }

        # Create a Money object with the new listing price and currency code
        new_listing_price = Money(amount=new_listing_price, currency_code=pricing_offer.sellerOffer.listingPrice.currency_code)

        # Prepare the result dictionary with the new listing price
        result = {
            "newListingPrice": new_listing_price.__dict__
        }

        return result
    except Exception as e:
        # Raise an exception if there's an error during the process
        raise Exception("Calling Pricing API failed", e)