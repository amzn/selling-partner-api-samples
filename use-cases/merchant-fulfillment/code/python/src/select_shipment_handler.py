import os
import logging
from datetime import datetime
from functools import cmp_to_key

from src.utils import constants

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    logger.info(f"SelectShipment Lambda input: {event}")

    shipping_service_list = event[constants.SHIPPING_SERVICE_LIST_KEY_NAME]
    try:
        if len(shipping_service_list) == 0:
            raise Exception("There are no shipping services to fulfill the order")

        # Select the shipping service based on the preference (cheapest/fastest)
        event['preferredShippingService'] = get_preferred_shipment(shipping_service_list)
        return event
    except Exception as e:
        raise Exception("Calling Merchant Fulfillment API failed", e)


def get_preferred_shipment(shipping_services):
    # Get the shipping preference from the Lambda function's environment variable
    # Update this section to match your product's logic
    shipment_filter_type = os.environ.get(constants.SHIPMENT_FILTER_TYPE_ENV_VARIABLE)

    if shipment_filter_type == constants.SHIPMENT_FILTER_TYPE_CHEAPEST:
        shipping_services.sort(key=cmp_to_key(price_comparator))
    elif shipment_filter_type == constants.SHIPMENT_FILTER_TYPE_FASTEST:
        shipping_services.sort(key=cmp_to_key(speed_comparator))

    return shipping_services[0]


def price_comparator(ship_service1, ship_service2):
    return ship_service1['Rate']['Amount'] - ship_service2['Rate']['Amount']


def speed_comparator(ship_service1, ship_service2):
    date_format = '%Y-%m-%dT%H:%M:%SZ'
    date_key = 'EarliestEstimatedDeliveryDate'

    return datetime.strptime(ship_service1[date_key], date_format) - datetime.strptime(ship_service2[date_key], date_format)
