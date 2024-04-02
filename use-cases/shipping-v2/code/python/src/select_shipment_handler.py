import os
import logging
from datetime import datetime
from functools import cmp_to_key
from dataclasses import asdict

from src.utils import constants
from src.utils.shipping_utils import ShippingLambdaInput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"SelectShipment Lambda input: {event}")

    try:
        shipping_lambda_input = ShippingLambdaInput(**event)
        shipping_service_list = shipping_lambda_input.rates.rates

        if len(shipping_service_list) == 0:
            raise Exception("There are no shipping services to fulfill the order")

        # Select the shipping service based on the preference (cheapest/fastest)
        shipping_lambda_input.rates.preferredRate = get_preferred_shipment(shipping_service_list)

        return asdict(shipping_lambda_input)
    except Exception as e:
        raise Exception("Calling Shipping API failed", e)


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
    return ship_service1.totalCharge.value - ship_service2.totalCharge.value


def speed_comparator(ship_service1, ship_service2):
    promise_date1 = datetime.strptime(ship_service1.promise.deliveryWindow.start, '%Y-%m-%dT%H:%M:%SZ')
    promise_date2 = datetime.strptime(ship_service2.promise.deliveryWindow.start, '%Y-%m-%dT%H:%M:%SZ')

    return -1 if promise_date1 < promise_date2 else 1 if promise_date1 > promise_date2 else 0
