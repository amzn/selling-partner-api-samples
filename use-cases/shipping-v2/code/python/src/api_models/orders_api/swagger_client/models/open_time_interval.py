# coding: utf-8

"""
    Selling Partner API for Orders

    The Selling Partner API for Orders helps you programmatically retrieve order information. These APIs let you develop fast, flexible, custom applications in areas like order synchronization, order research, and demand-based decision support tools. The Orders API only supports orders that are less than two years old. Orders more than two years old will not show in the API response.  # noqa: E501

    OpenAPI spec version: v0
    
    Generated by: https://github.com/swagger-api/swagger-codegen.git
"""


import pprint
import re  # noqa: F401

import six

from src.api_models.orders_api.swagger_client.configuration import Configuration


class OpenTimeInterval(object):
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
        'hour': 'int',
        'minute': 'int'
    }

    attribute_map = {
        'hour': 'Hour',
        'minute': 'Minute'
    }

    def __init__(self, hour=None, minute=None, _configuration=None):  # noqa: E501
        """OpenTimeInterval - a model defined in Swagger"""  # noqa: E501
        if _configuration is None:
            _configuration = Configuration()
        self._configuration = _configuration

        self._hour = None
        self._minute = None
        self.discriminator = None

        if hour is not None:
            self.hour = hour
        if minute is not None:
            self.minute = minute

    @property
    def hour(self):
        """Gets the hour of this OpenTimeInterval.  # noqa: E501

        The hour when the business opens or closes.  # noqa: E501

        :return: The hour of this OpenTimeInterval.  # noqa: E501
        :rtype: int
        """
        return self._hour

    @hour.setter
    def hour(self, hour):
        """Sets the hour of this OpenTimeInterval.

        The hour when the business opens or closes.  # noqa: E501

        :param hour: The hour of this OpenTimeInterval.  # noqa: E501
        :type: int
        """

        self._hour = hour

    @property
    def minute(self):
        """Gets the minute of this OpenTimeInterval.  # noqa: E501

        The minute when the business opens or closes.  # noqa: E501

        :return: The minute of this OpenTimeInterval.  # noqa: E501
        :rtype: int
        """
        return self._minute

    @minute.setter
    def minute(self, minute):
        """Sets the minute of this OpenTimeInterval.

        The minute when the business opens or closes.  # noqa: E501

        :param minute: The minute of this OpenTimeInterval.  # noqa: E501
        :type: int
        """

        self._minute = minute

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
        if issubclass(OpenTimeInterval, dict):
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
        if not isinstance(other, OpenTimeInterval):
            return False

        return self.to_dict() == other.to_dict()

    def __ne__(self, other):
        """Returns true if both objects are not equal"""
        if not isinstance(other, OpenTimeInterval):
            return True

        return self.to_dict() != other.to_dict()