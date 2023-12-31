# coding: utf-8

"""
    Selling Partner API for Solicitations

    With the Solicitations API you can build applications that send non-critical solicitations to buyers. You can get a list of solicitation types that are available for an order that you specify, then call an operation that sends a solicitation to the buyer for that order. Buyers cannot respond to solicitations sent by this API, and these solicitations do not appear in the Messaging section of Seller Central or in the recipient's Message Center. The Solicitations API returns responses that are formed according to the <a href=https://tools.ietf.org/html/draft-kelly-json-hal-08>JSON Hypertext Application Language</a> (HAL) standard.  # noqa: E501

    OpenAPI spec version: v1
    
    Generated by: https://github.com/swagger-api/swagger-codegen.git
"""


import pprint
import re  # noqa: F401

import six


class GetSolicitationActionsForOrderResponseLinks(object):
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
        '_self': 'LinkObject',
        'actions': 'list[LinkObject]'
    }

    attribute_map = {
        '_self': 'self',
        'actions': 'actions'
    }

    def __init__(self, _self=None, actions=None):  # noqa: E501
        """GetSolicitationActionsForOrderResponseLinks - a model defined in Swagger"""  # noqa: E501

        self.__self = None
        self._actions = None
        self.discriminator = None

        self._self = _self
        self.actions = actions

    @property
    def _self(self):
        """Gets the _self of this GetSolicitationActionsForOrderResponseLinks.  # noqa: E501


        :return: The _self of this GetSolicitationActionsForOrderResponseLinks.  # noqa: E501
        :rtype: LinkObject
        """
        return self.__self

    @_self.setter
    def _self(self, _self):
        """Sets the _self of this GetSolicitationActionsForOrderResponseLinks.


        :param _self: The _self of this GetSolicitationActionsForOrderResponseLinks.  # noqa: E501
        :type: LinkObject
        """
        if _self is None:
            raise ValueError("Invalid value for `_self`, must not be `None`")  # noqa: E501

        self.__self = _self

    @property
    def actions(self):
        """Gets the actions of this GetSolicitationActionsForOrderResponseLinks.  # noqa: E501

        Eligible actions for the specified amazonOrderId.  # noqa: E501

        :return: The actions of this GetSolicitationActionsForOrderResponseLinks.  # noqa: E501
        :rtype: list[LinkObject]
        """
        return self._actions

    @actions.setter
    def actions(self, actions):
        """Sets the actions of this GetSolicitationActionsForOrderResponseLinks.

        Eligible actions for the specified amazonOrderId.  # noqa: E501

        :param actions: The actions of this GetSolicitationActionsForOrderResponseLinks.  # noqa: E501
        :type: list[LinkObject]
        """
        if actions is None:
            raise ValueError("Invalid value for `actions`, must not be `None`")  # noqa: E501

        self._actions = actions

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
        if issubclass(GetSolicitationActionsForOrderResponseLinks, dict):
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
        if not isinstance(other, GetSolicitationActionsForOrderResponseLinks):
            return False

        return self.__dict__ == other.__dict__

    def __ne__(self, other):
        """Returns true if both objects are not equal"""
        return not self == other
