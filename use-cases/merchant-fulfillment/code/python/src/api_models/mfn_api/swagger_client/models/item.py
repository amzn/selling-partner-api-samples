# coding: utf-8

"""
    Selling Partner API for Merchant Fulfillment

    The Selling Partner API for Merchant Fulfillment helps you build applications that let sellers purchase shipping for non-Prime and Prime orders using Amazon’s Buy Shipping Services.  # noqa: E501

    OpenAPI spec version: v0
    
    Generated by: https://github.com/swagger-api/swagger-codegen.git
"""


import pprint
import re  # noqa: F401

import six

from src.api_models.mfn_api.swagger_client.configuration import Configuration


class Item(object):
    """NOTE: This class is auto generated by the swagger code generator program.

    Do not edit the class manually.
    """

    """
    Attributes:
      swagger_types (dict): The key is attribute name
                            and the value is attribute type.
      attribute_map (dict): The key is attribute name
                            and the value is json key in definition.
    """
    swagger_types = {
        'order_item_id': 'OrderItemId',
        'quantity': 'ItemQuantity',
        'item_weight': 'Weight',
        'item_description': 'ItemDescription',
        'transparency_code_list': 'TransparencyCodeList',
        'item_level_seller_inputs_list': 'AdditionalSellerInputsList'
    }

    attribute_map = {
        'order_item_id': 'OrderItemId',
        'quantity': 'Quantity',
        'item_weight': 'ItemWeight',
        'item_description': 'ItemDescription',
        'transparency_code_list': 'TransparencyCodeList',
        'item_level_seller_inputs_list': 'ItemLevelSellerInputsList'
    }

    def __init__(self, order_item_id=None, quantity=None, item_weight=None, item_description=None, transparency_code_list=None, item_level_seller_inputs_list=None, _configuration=None):  # noqa: E501
        """Item - a model defined in Swagger"""  # noqa: E501
        if _configuration is None:
            _configuration = Configuration()
        self._configuration = _configuration

        self._order_item_id = None
        self._quantity = None
        self._item_weight = None
        self._item_description = None
        self._transparency_code_list = None
        self._item_level_seller_inputs_list = None
        self.discriminator = None

        self.order_item_id = order_item_id
        self.quantity = quantity
        if item_weight is not None:
            self.item_weight = item_weight
        if item_description is not None:
            self.item_description = item_description
        if transparency_code_list is not None:
            self.transparency_code_list = transparency_code_list
        if item_level_seller_inputs_list is not None:
            self.item_level_seller_inputs_list = item_level_seller_inputs_list

    @property
    def order_item_id(self):
        """Gets the order_item_id of this Item.  # noqa: E501


        :return: The order_item_id of this Item.  # noqa: E501
        :rtype: OrderItemId
        """
        return self._order_item_id

    @order_item_id.setter
    def order_item_id(self, order_item_id):
        """Sets the order_item_id of this Item.


        :param order_item_id: The order_item_id of this Item.  # noqa: E501
        :type: OrderItemId
        """
        if self._configuration.client_side_validation and order_item_id is None:
            raise ValueError("Invalid value for `order_item_id`, must not be `None`")  # noqa: E501

        self._order_item_id = order_item_id

    @property
    def quantity(self):
        """Gets the quantity of this Item.  # noqa: E501


        :return: The quantity of this Item.  # noqa: E501
        :rtype: ItemQuantity
        """
        return self._quantity

    @quantity.setter
    def quantity(self, quantity):
        """Sets the quantity of this Item.


        :param quantity: The quantity of this Item.  # noqa: E501
        :type: ItemQuantity
        """
        if self._configuration.client_side_validation and quantity is None:
            raise ValueError("Invalid value for `quantity`, must not be `None`")  # noqa: E501

        self._quantity = quantity

    @property
    def item_weight(self):
        """Gets the item_weight of this Item.  # noqa: E501


        :return: The item_weight of this Item.  # noqa: E501
        :rtype: Weight
        """
        return self._item_weight

    @item_weight.setter
    def item_weight(self, item_weight):
        """Sets the item_weight of this Item.


        :param item_weight: The item_weight of this Item.  # noqa: E501
        :type: Weight
        """

        self._item_weight = item_weight

    @property
    def item_description(self):
        """Gets the item_description of this Item.  # noqa: E501


        :return: The item_description of this Item.  # noqa: E501
        :rtype: ItemDescription
        """
        return self._item_description

    @item_description.setter
    def item_description(self, item_description):
        """Sets the item_description of this Item.


        :param item_description: The item_description of this Item.  # noqa: E501
        :type: ItemDescription
        """

        self._item_description = item_description

    @property
    def transparency_code_list(self):
        """Gets the transparency_code_list of this Item.  # noqa: E501


        :return: The transparency_code_list of this Item.  # noqa: E501
        :rtype: TransparencyCodeList
        """
        return self._transparency_code_list

    @transparency_code_list.setter
    def transparency_code_list(self, transparency_code_list):
        """Sets the transparency_code_list of this Item.


        :param transparency_code_list: The transparency_code_list of this Item.  # noqa: E501
        :type: TransparencyCodeList
        """

        self._transparency_code_list = transparency_code_list

    @property
    def item_level_seller_inputs_list(self):
        """Gets the item_level_seller_inputs_list of this Item.  # noqa: E501

        A list of additional seller inputs required to ship this item using the chosen shipping service.  # noqa: E501

        :return: The item_level_seller_inputs_list of this Item.  # noqa: E501
        :rtype: AdditionalSellerInputsList
        """
        return self._item_level_seller_inputs_list

    @item_level_seller_inputs_list.setter
    def item_level_seller_inputs_list(self, item_level_seller_inputs_list):
        """Sets the item_level_seller_inputs_list of this Item.

        A list of additional seller inputs required to ship this item using the chosen shipping service.  # noqa: E501

        :param item_level_seller_inputs_list: The item_level_seller_inputs_list of this Item.  # noqa: E501
        :type: AdditionalSellerInputsList
        """

        self._item_level_seller_inputs_list = item_level_seller_inputs_list

    def to_dict(self):
        """Returns the model properties as a dict"""
        result = {}

        for attr, _ in six.iteritems(self.swagger_types):
            value = getattr(self, attr)
            if isinstance(value, list):
                result[attr] = list(map(
                    lambda x: x.to_dict() if hasattr(x, "to_dict") else x,
                    value
                ))
            elif hasattr(value, "to_dict"):
                result[attr] = value.to_dict()
            elif isinstance(value, dict):
                result[attr] = dict(map(
                    lambda item: (item[0], item[1].to_dict())
                    if hasattr(item[1], "to_dict") else item,
                    value.items()
                ))
            else:
                result[attr] = value
        if issubclass(Item, dict):
            for key, value in self.items():
                result[key] = value

        return result

    def to_str(self):
        """Returns the string representation of the model"""
        return pprint.pformat(self.to_dict())

    def __repr__(self):
        """For `print` and `pprint`"""
        return self.to_str()

    def __eq__(self, other):
        """Returns true if both objects are equal"""
        if not isinstance(other, Item):
            return False

        return self.to_dict() == other.to_dict()

    def __ne__(self, other):
        """Returns true if both objects are not equal"""
        if not isinstance(other, Item):
            return True

        return self.to_dict() != other.to_dict()
