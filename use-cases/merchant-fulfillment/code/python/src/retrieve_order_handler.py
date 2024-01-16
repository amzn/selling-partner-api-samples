import os
import re
import logging

from src.utils import constants
from src.utils.api_utils import ApiUtils
from src.utils.mfn_order import MfnOrder
from src.utils.mfn_utils import get_order_item_list

from src.api_models.mfn_api.swagger_client.models.address import Address as MfnAddress

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):

    # Extract refresh token from event
    refresh_token = event[constants.STATE_MACHINE_REFRESH_TOKEN_KEY_NAME]

    # Extract region code from event
    region_code = event[constants.STATE_MACHINE_REGION_CODE_KEY_NAME]

    logger.info(f"RetrieveOrder Lambda input: {event}")

    try:
        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(refresh_token, region_code, constants.ORDERS_API_TYPE)

        order_id = event[constants.STATE_MACHINE_ORDER_ID_KEY_NAME]
        mfn_email = os.environ.get(constants.SHIP_FROM_EMAIL_ENV_VARIABLE)

        # Get order and order items
        order_response = api_utils.call_orders_api(method='get_order', order_id=order_id)
        order_items_response = api_utils.call_orders_api(method='get_order_items', order_id=order_id)

        logger.info(f"Orders API Response: {order_response}")
        logger.info(f"Order Items API  Response: {order_items_response}")

        mfn_order_items = get_order_item_list(order_items=order_items_response)
        mfn_ship_from_address = map_address(order_response.payload.default_ship_from_location_address, mfn_email=mfn_email)

        mfn_order = MfnOrder(order_items=mfn_order_items, ship_from_address=mfn_ship_from_address)

        return mfn_order.to_json()
    except Exception as e:
        raise Exception("Calling Orders API failed", e)


def map_address(order_address, mfn_email):
    mfn_phone = re.sub(r'[^0-9]', '', order_address.phone)

    mfn_address = MfnAddress(name=order_address.name,
                             address_line1=order_address.address_line1,
                             city=order_address.city,
                             state_or_province_code=order_address.state_or_region,
                             postal_code=order_address.postal_code,
                             phone=mfn_phone,
                             country_code=order_address.country_code,
                             email=mfn_email)
    return mfn_address
