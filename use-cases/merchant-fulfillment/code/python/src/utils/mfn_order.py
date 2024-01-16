from typing import List

from src.utils.mfn_order_item import MfnOrderItem

from src.api_models.mfn_api.swagger_client.models.package_dimensions import PackageDimensions
from src.api_models.mfn_api.swagger_client.models.address import Address
from src.api_models.mfn_api.swagger_client.models.shipping_service import ShippingService
from src.api_models.mfn_api.swagger_client.models.weight import Weight


class MfnOrder(object):
    def __init__(self,
                 order_items: List[MfnOrderItem] = None,
                 ship_from_address: Address = None,
                 package_dimensions: PackageDimensions = None,
                 weight: Weight = None,
                 shipping_service_list: List[ShippingService] = None,
                 preferred_shipping_service: ShippingService = None):
        self.orderItems = order_items
        self.shipFromAddress = ship_from_address
        self.packageDimensions = package_dimensions
        self.weight = weight
        self.shippingServiceList = shipping_service_list
        self.preferredShippingService = preferred_shipping_service

    def to_json(self):
        def convert_to_dict(obj):
            if hasattr(obj, 'to_json') and callable(getattr(obj, 'to_json')):
                return obj.to_json()
            elif hasattr(obj, 'to_dict') and callable(getattr(obj, 'to_dict')):
                return obj.to_dict()
            elif isinstance(obj, list):
                return [convert_to_dict(item) for item in obj]
            elif isinstance(obj, dict):
                return {key: convert_to_dict(value) for key, value in obj.items()}
            else:
                return obj

        return {
            "orderItems": convert_to_dict(self.orderItems) if self.orderItems else [],
            "shipFromAddress": self.shipFromAddress.to_dict() if self.shipFromAddress else {},
            "packageDimensions": self.packageDimensions.to_dict() if self.packageDimensions else {},
            "weight": self.weight.to_dict() if self.weight else {},
            "shippingServiceList": convert_to_dict(self.shippingServiceList) if self.shippingServiceList else {},
            "preferredShippingService": self.preferredShippingService.to_dict() if self.preferredShippingService else {}
        }

    @classmethod
    def from_dict(cls, data):
        # Assuming the structure of shippingServiceList and preferredShippingService dictionaries
        shipping_service_list_data = data.get("shippingServiceList", [])
        shipping_service_data = data.get("preferredShippingService", {})

        # Manually construct ShippingServiceList and ShippingService objects
        shipping_service_list = [ShippingService(**item_data) for item_data in shipping_service_list_data]
        if shipping_service_data:
            preferred_shipping_service = ShippingService(**shipping_service_data)
        else:
            preferred_shipping_service = None

        weight_dict = data.get("weight", {})
        if weight_dict:
            weight_data = Weight(**data.get("weight", {}))
        else:
            weight_data = None

        return cls(
            order_items=[MfnOrderItem.from_dict(item_data) for item_data in data.get("orderItems", [])],
            ship_from_address=Address(**data.get("shipFromAddress", {})),
            package_dimensions=PackageDimensions(**data.get("packageDimensions", {})),
            weight=weight_data,
            shipping_service_list=shipping_service_list,
            preferred_shipping_service=preferred_shipping_service
        )
