import os
import re
import logging

from dataclasses import asdict

from src.utils import constants
from src.utils.api_utils import ApiUtils
from src.utils.shipping_utils import ShippingLambdaInput, Address, OrderItem, MfnOrder, Currency

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"RetrieveOrder Lambda input: {event}")

    # Extract refresh token from environment variables
    region_code = os.environ.get(constants.REGION_CODE_ARN_ENV_VARIABLE)

    # Extract region code from environment variables
    refresh_token = os.environ.get(constants.REFRESH_TOKEN_ARN_ENV_VARIABLE)

    try:
        # Instantiate MfnOrder object from the input event
        get_order_lambda_input = ShippingLambdaInput(**event)

        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(region_code,
                             refresh_token,
                             constants.ORDERS_API_TYPE)

        # Retrieve email address for the label sending
        ship_from_email = os.environ.get(constants.SHIP_FROM_EMAIL_ENV_VARIABLE)

        # API calls to retrieve order and order items
        order_response = api_utils.call_orders_api(method='get_order',
                                                   order_id=get_order_lambda_input.credentials.orderId)
        order_items_response = api_utils.call_orders_api(method='get_order_items',
                                                         order_id=get_order_lambda_input.credentials.orderId)

        logger.info(f"Orders API Response: {order_response}")
        logger.info(f"Order Items API Response: {order_items_response}")

        order_address_response = api_utils.call_orders_api(method='get_order_address',
                                                           order_id=get_order_lambda_input.credentials.orderId)
        logger.info(f"Order Address API Response: {order_address_response}")

        # Check if the response has a payload attribute and use it directly
        if hasattr(order_address_response, 'payload'):
            ship_to_address = map_address(order_address_response.payload.shipping_address)
            ship_from_address = map_address(order_response.payload.default_ship_from_location_address, ship_from_email)

        else:
            logger.error("Shipping address not accessible in the response object")
            raise Exception("Shipping address is not accessible")

        # Return the ShippingOrder object in JSON format
        get_order_lambda_input.mfnOrder = MfnOrder()
        get_order_lambda_input.mfnOrder.orderItems = map_order_items(order_items_response.payload.order_items)
        get_order_lambda_input.mfnOrder.shipFromAddress = ship_from_address
        get_order_lambda_input.mfnOrder.shipToAddress = ship_to_address

        result = asdict(get_order_lambda_input)
        return result
    except Exception as e:
        logger.error("Error in Retrieve Order Lambda Handler", exc_info=True)
        raise Exception("Calling Orders API failed", e)


def map_address(order_address, ship_from_email=None):
    # Initialize OrdersApiAddress object with available attributes
    address_mapping = {
        'name': order_address.name,
        'addressLine1': order_address.address_line1,
        'addressLine2': order_address.address_line2,
        'addressLine3': order_address.address_line3,
        'city': order_address.city,
        'countryCode': order_address.country_code,
        'postalCode': order_address.postal_code,
        'stateOrRegion': order_address.state_or_region,
        'phoneNumber': re.sub(r'[^0-9]', '', order_address.phone or ''),
        'email': ship_from_email
    }

    return Address(**address_mapping)


def map_order_items(order_items_list):
    order_items = []
    for item_dict in order_items_list:
        item_price_dict = item_dict.get("ItemPrice", {})
        currency_code = item_price_dict.get("CurrencyCode", "USD")  # Default to USD if not specified
        amount_str = item_price_dict.get("Amount")
        if amount_str is None:
            logging.error(f"Amount not found for OrderItemId: {item_dict.get('OrderItemId')}")
            continue
        try:
            amount = float(amount_str)
        except ValueError:
            logging.error(f"Invalid amount value '{amount_str}' for OrderItemId: {item_dict.get('OrderItemId')}")
            continue

        value = Currency(value=amount, unit=currency_code)
        order_item = OrderItem(
            orderItemId=item_dict.get("OrderItemId"),
            sku=item_dict.get("SellerSKU"),
            quantity=int(item_dict.get("QuantityOrdered", 0)),  # Default to 0 if not specified
            value=value
        )
        order_items.append(order_item)
    return order_items
