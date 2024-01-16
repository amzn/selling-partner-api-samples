import json
import logging

from src.utils import constants
from src.utils import mfn_utils
from src.utils.mfn_order import MfnOrder
from src.utils.api_utils import ApiUtils

from src.api_models.mfn_api.swagger_client.models.shipping_service_options import ShippingServiceOptions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    # Extract refresh token from event
    refresh_token = event[constants.STATE_MACHINE_REFRESH_TOKEN_KEY_NAME]

    # Extract region code from event
    region_code = event[constants.STATE_MACHINE_REGION_CODE_KEY_NAME]

    # Extract order ID from event
    order_id = event[constants.STATE_MACHINE_ORDER_ID_KEY_NAME]

    logger.info(f"EligibleShipment Lambda input: {event}")

    try:
        mfn_order = MfnOrder.from_dict(event[constants.MFN_ORDER_KEY_NAME])

        # Create an instance of the ApiUtils class
        api_utils = ApiUtils(refresh_token, region_code, constants.MFN_API_TYPE)

        # Get eligible shipment services for the order
        eligible_shipment_request = get_eligible_shipment_request_body(mfn_order=mfn_order, order_id=order_id)
        logger.info(f"Merchant Fulfillment API - GetEligibleShipmentServices request: {eligible_shipment_request}")

        eligible_shipment_response = api_utils.call_mfn_api('get_eligible_shipment_services', body=eligible_shipment_request)
        mfn_order.shippingServiceList = [item for item in eligible_shipment_response.payload.shipping_service_list]

        return mfn_order.to_json()

    except json.JSONDecodeError as e:
        raise Exception("Message body could not be mapped to MfnOrder") from e

    except Exception as e:
        raise Exception("Calling Merchant Fulfillment API failed") from e


def get_eligible_shipment_request_body(mfn_order, order_id):
    order_item_list = json.loads(mfn_utils.transform_keys_to_uppercase_first_letter(json.dumps([item.to_json() for item in mfn_order.orderItems])))
    ship_from_address = json.loads(mfn_utils.snake_to_pascal_case(json.dumps(mfn_order.shipFromAddress.to_dict())))
    package_dimensions = json.loads(mfn_utils.snake_to_pascal_case(json.dumps(mfn_order.packageDimensions.to_dict())))
    weight = json.loads(mfn_utils.snake_to_pascal_case(json.dumps(mfn_order.weight.to_dict())))

    shipping_service_options = json.loads(mfn_utils.snake_to_pascal_case(json.dumps(get_default_shipping_service_options().to_dict())))

    request = {
        "ShipmentRequestDetails": {
            "AmazonOrderId": order_id,
            "ItemList": order_item_list,
            "ShipFromAddress": ship_from_address,
            "PackageDimensions": package_dimensions,
            "Weight": weight,
            "ShippingServiceOptions": shipping_service_options
        }
    }

    return json.dumps(request)


def get_default_shipping_service_options():
    return ShippingServiceOptions(delivery_experience=mfn_utils.DELIVERY_EXPERIENCE_TYPE,
                                  carrier_will_pick_up=mfn_utils.CARRIER_WILL_PICK_UP,
                                  label_format=mfn_utils.LABEL_FORMAT,
                                  carrier_will_pick_up_option=None,
                                  declared_value=None)
