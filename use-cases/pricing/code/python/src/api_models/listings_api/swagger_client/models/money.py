# coding: utf-8

"""
    Selling Partner API for Listings Items

    The Selling Partner API for Listings Items (Listings Items API) provides programmatic access to selling partner listings on Amazon. Use this API in collaboration with the Selling Partner API for Product Type Definitions, which you use to retrieve the information about Amazon product types needed to use the Listings Items API.  For more information, see the [Listings Items API Use Case Guide](doc:listings-items-api-v2021-08-01-use-case-guide).  # noqa: E501

    OpenAPI spec version: 2021-08-01
    
    Generated by: https://github.com/swagger-api/swagger-codegen.git
"""


import pprint
import re  # noqa: F401

import six

from src.api_models.listings_api.swagger_client.configuration import Configuration


class Money(object):
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
        'currency_code': 'str',
        'amount': 'Decimal'
    }

    attribute_map = {
        'currency_code': 'currencyCode',
        'amount': 'amount'
    }

    def __init__(self, currency_code=None, amount=None, _configuration=None):  # noqa: E501
        """Money - a model defined in Swagger"""  # noqa: E501
        if _configuration is None:
            _configuration = Configuration()
        self._configuration = _configuration

        self._currency_code = None
        self._amount = None
        self.discriminator = None

        self.currency_code = currency_code
        self.amount = amount

    @property
    def currency_code(self):
        """Gets the currency_code of this Money.  # noqa: E501

        Three-digit currency code. In ISO 4217 format.  # noqa: E501

        :return: The currency_code of this Money.  # noqa: E501
        :rtype: str
        """
        return self._currency_code

    @currency_code.setter
    def currency_code(self, currency_code):
        """Sets the currency_code of this Money.

        Three-digit currency code. In ISO 4217 format.  # noqa: E501

        :param currency_code: The currency_code of this Money.  # noqa: E501
        :type: str
        """
        if self._configuration.client_side_validation and currency_code is None:
            raise ValueError("Invalid value for `currency_code`, must not be `None`")  # noqa: E501

        self._currency_code = currency_code

    @property
    def amount(self):
        """Gets the amount of this Money.  # noqa: E501

        The currency amount.  # noqa: E501

        :return: The amount of this Money.  # noqa: E501
        :rtype: Decimal
        """
        return self._amount

    @amount.setter
    def amount(self, amount):
        """Sets the amount of this Money.

        The currency amount.  # noqa: E501

        :param amount: The amount of this Money.  # noqa: E501
        :type: Decimal
        """
        if self._configuration.client_side_validation and amount is None:
            raise ValueError("Invalid value for `amount`, must not be `None`")  # noqa: E501

        self._amount = amount

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
        if issubclass(Money, dict):
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
        if not isinstance(other, Money):
            return False

        return self.to_dict() == other.to_dict()

    def __ne__(self, other):
        """Returns true if both objects are not equal"""
        if not isinstance(other, Money):
            return True

        return self.to_dict() != other.to_dict()