from src.api_models.mfn_api.swagger_client.models.weight import Weight


class MfnOrderItem(object):
    def __init__(self, order_item_id: str = None, sku: str = None, quantity: int = None, item_weight: Weight = None):
        self.orderItemId = order_item_id
        self.sku = sku
        self.quantity = quantity
        self.itemWeight = item_weight

    def to_json(self):
        def convert_to_dict(obj):
            if hasattr(obj, 'to_json') and callable(getattr(obj, 'to_json')):
                return obj.to_json()
            elif isinstance(obj, list):
                return [convert_to_dict(item) for item in obj]
            elif isinstance(obj, dict):
                return {key: convert_to_dict(value) for key, value in obj.items()}
            else:
                return obj

        return {
            "orderItemId": self.orderItemId,
            "sku": self.sku,
            "quantity": self.quantity,
            "itemWeight": self.itemWeight.to_dict() if self.itemWeight else {}
        }


    @classmethod
    def from_dict(cls, data):
        return cls(
            order_item_id=data.get("orderItemId"),
            sku=data.get("sku"),
            quantity=data.get("quantity"),
            item_weight=Weight(**data.get("itemWeight")) if data.get("itemWeight") else None
        )