import json

from src.utils.mfn_order_item import MfnOrderItem

from src.api_models.mfn_api.swagger_client.models.delivery_experience_type import DeliveryExperienceType
from src.api_models.mfn_api.swagger_client.models.label_format import LabelFormat


# Default shipping service options
DELIVERY_EXPERIENCE_TYPE = DeliveryExperienceType.DELIVERYCONFIRMATIONWITHOUTSIGNATURE
CARRIER_WILL_PICK_UP = False
LABEL_FORMAT = LabelFormat.PNG


"""
Set of utils functions to fetch and generate models
"""


def get_order_item_list(order_items):
    item_list = []
    for order_item in order_items.payload.order_items:
        item = MfnOrderItem(order_item_id=order_item["OrderItemId"], sku=order_item["SellerSKU"],
                            quantity=order_item["QuantityOrdered"])
        item_list.append(item)
    return item_list


"""
Set of functions to manipulate request parameters
"""


def capitalize_first_letter(key):
    if len(key) > 0:
        return key[0].upper() + key[1:]
    else:
        return key


def transform_keys_to_uppercase_first_letter(json_str):
    try:
        json_obj = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")

    def transform(obj):
        if isinstance(obj, dict):
            return {capitalize_first_letter(key): transform(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [transform(item) for item in obj]
        else:
            return obj

    transformed_json = transform(json_obj)
    return json.dumps(transformed_json, indent=2)


def snake_to_pascal_case(input_json):
    def to_pascal_case(snake_str):
        components = snake_str.split('_')
        return ''.join(x.capitalize() for x in components)

    def is_pascal_case(key):
        # Check if a key is already in Pascal case (first letter uppercase, rest lowercase)
        return key.isidentifier() and key[0].isupper() and key[1:].islower()

    def transform_keys(obj):
        if isinstance(obj, list):
            return [transform_keys(item) for item in obj]
        elif isinstance(obj, dict):
            return {to_pascal_case(key) if not is_pascal_case(key) else key: transform_keys(value) for key, value in
                    obj.items()}
        else:
            return obj

    try:
        parsed_json = json.loads(input_json)
        transformed_json = transform_keys(parsed_json)

        return json.dumps(transformed_json, indent=2)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")