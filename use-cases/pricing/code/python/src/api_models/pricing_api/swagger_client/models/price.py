# coding: utf-8

"""
    Selling Partner API for Pricing

    The Selling Partner API for Pricing helps you programmatically retrieve product pricing and offer information for Amazon Marketplace products.  # noqa: E501

    OpenAPI spec version: v0
    
    Generated by: https://github.com/swagger-api/swagger-codegen.git
"""


import pprint
import re  # noqa: F401

import six

from src.api_models.pricing_api.swagger_client.configuration import Configuration


class Price(object):
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
        'status': 'str',
        'seller_sku': 'str',
        'asin': 'str',
        'product': 'Product'
    }

    attribute_map = {
        'status': 'status',
        'seller_sku': 'SellerSKU',
        'asin': 'ASIN',
        'product': 'Product'
    }

    def __init__(self, status=None, seller_sku=None, asin=None, product=None, _configuration=None):  # noqa: E501
        """Price - a model defined in Swagger"""  # noqa: E501
        if _configuration is None:
            _configuration = Configuration()
        self._configuration = _configuration

        self._status = None
        self._seller_sku = None
        self._asin = None
        self._product = None
        self.discriminator = None

        self.status = status
        if seller_sku is not None:
            self.seller_sku = seller_sku
        if asin is not None:
            self.asin = asin
        if product is not None:
            self.product = product

    @property
    def status(self):
        """Gets the status of this Price.  # noqa: E501

        The status of the operation.  # noqa: E501

        :return: The status of this Price.  # noqa: E501
        :rtype: str
        """
        return self._status

    @status.setter
    def status(self, status):
        """Sets the status of this Price.

        The status of the operation.  # noqa: E501

        :param status: The status of this Price.  # noqa: E501
        :type: str
        """
        if self._configuration.client_side_validation and status is None:
            raise ValueError("Invalid value for `status`, must not be `None`")  # noqa: E501

        self._status = status

    @property
    def seller_sku(self):
        """Gets the seller_sku of this Price.  # noqa: E501

        The seller stock keeping unit (SKU) of the item.  # noqa: E501

        :return: The seller_sku of this Price.  # noqa: E501
        :rtype: str
        """
        return self._seller_sku

    @seller_sku.setter
    def seller_sku(self, seller_sku):
        """Sets the seller_sku of this Price.

        The seller stock keeping unit (SKU) of the item.  # noqa: E501

        :param seller_sku: The seller_sku of this Price.  # noqa: E501
        :type: str
        """

        self._seller_sku = seller_sku

    @property
    def asin(self):
        """Gets the asin of this Price.  # noqa: E501

        The Amazon Standard Identification Number (ASIN) of the item.  # noqa: E501

        :return: The asin of this Price.  # noqa: E501
        :rtype: str
        """
        return self._asin

    @asin.setter
    def asin(self, asin):
        """Sets the asin of this Price.

        The Amazon Standard Identification Number (ASIN) of the item.  # noqa: E501

        :param asin: The asin of this Price.  # noqa: E501
        :type: str
        """

        self._asin = asin

    @property
    def product(self):
        """Gets the product of this Price.  # noqa: E501


        :return: The product of this Price.  # noqa: E501
        :rtype: Product
        """
        return self._product

    @product.setter
    def product(self, product):
        """Sets the product of this Price.


        :param product: The product of this Price.  # noqa: E501
        :type: Product
        """

        self._product = product

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
        if issubclass(Price, dict):
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
        if not isinstance(other, Price):
            return False

        return self.to_dict() == other.to_dict()

    def __ne__(self, other):
        """Returns true if both objects are not equal"""
        if not isinstance(other, Price):
            return True

        return self.to_dict() != other.to_dict()