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


class Issue(object):
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
        'code': 'str',
        'message': 'str',
        'severity': 'str',
        'attribute_names': 'list[str]'
    }

    attribute_map = {
        'code': 'code',
        'message': 'message',
        'severity': 'severity',
        'attribute_names': 'attributeNames'
    }

    def __init__(self, code=None, message=None, severity=None, attribute_names=None, _configuration=None):  # noqa: E501
        """Issue - a model defined in Swagger"""  # noqa: E501
        if _configuration is None:
            _configuration = Configuration()
        self._configuration = _configuration

        self._code = None
        self._message = None
        self._severity = None
        self._attribute_names = None
        self.discriminator = None

        self.code = code
        self.message = message
        self.severity = severity
        if attribute_names is not None:
            self.attribute_names = attribute_names

    @property
    def code(self):
        """Gets the code of this Issue.  # noqa: E501

        An issue code that identifies the type of issue.  # noqa: E501

        :return: The code of this Issue.  # noqa: E501
        :rtype: str
        """
        return self._code

    @code.setter
    def code(self, code):
        """Sets the code of this Issue.

        An issue code that identifies the type of issue.  # noqa: E501

        :param code: The code of this Issue.  # noqa: E501
        :type: str
        """
        if self._configuration.client_side_validation and code is None:
            raise ValueError("Invalid value for `code`, must not be `None`")  # noqa: E501

        self._code = code

    @property
    def message(self):
        """Gets the message of this Issue.  # noqa: E501

        A message that describes the issue.  # noqa: E501

        :return: The message of this Issue.  # noqa: E501
        :rtype: str
        """
        return self._message

    @message.setter
    def message(self, message):
        """Sets the message of this Issue.

        A message that describes the issue.  # noqa: E501

        :param message: The message of this Issue.  # noqa: E501
        :type: str
        """
        if self._configuration.client_side_validation and message is None:
            raise ValueError("Invalid value for `message`, must not be `None`")  # noqa: E501

        self._message = message

    @property
    def severity(self):
        """Gets the severity of this Issue.  # noqa: E501

        The severity of the issue.  # noqa: E501

        :return: The severity of this Issue.  # noqa: E501
        :rtype: str
        """
        return self._severity

    @severity.setter
    def severity(self, severity):
        """Sets the severity of this Issue.

        The severity of the issue.  # noqa: E501

        :param severity: The severity of this Issue.  # noqa: E501
        :type: str
        """
        if self._configuration.client_side_validation and severity is None:
            raise ValueError("Invalid value for `severity`, must not be `None`")  # noqa: E501
        allowed_values = ["ERROR", "WARNING", "INFO"]  # noqa: E501
        if (self._configuration.client_side_validation and
                severity not in allowed_values):
            raise ValueError(
                "Invalid value for `severity` ({0}), must be one of {1}"  # noqa: E501
                .format(severity, allowed_values)
            )

        self._severity = severity

    @property
    def attribute_names(self):
        """Gets the attribute_names of this Issue.  # noqa: E501

        Names of the attributes associated with the issue, if applicable.  # noqa: E501

        :return: The attribute_names of this Issue.  # noqa: E501
        :rtype: list[str]
        """
        return self._attribute_names

    @attribute_names.setter
    def attribute_names(self, attribute_names):
        """Sets the attribute_names of this Issue.

        Names of the attributes associated with the issue, if applicable.  # noqa: E501

        :param attribute_names: The attribute_names of this Issue.  # noqa: E501
        :type: list[str]
        """

        self._attribute_names = attribute_names

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
        if issubclass(Issue, dict):
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
        if not isinstance(other, Issue):
            return False

        return self.to_dict() == other.to_dict()

    def __ne__(self, other):
        """Returns true if both objects are not equal"""
        if not isinstance(other, Issue):
            return True

        return self.to_dict() != other.to_dict()
