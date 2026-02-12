from dataclasses import dataclass
from typing import Any, Optional, TypeVar, Type, cast
from enum import Enum

T = TypeVar("T")
EnumT = TypeVar("EnumT", bound=Enum)

def from_str(x: Any) -> str:
    assert isinstance(x, str)
    return x


def from_none(x: Any) -> Any:
    assert x is None
    return x


def from_union(fs, x):
    for f in fs:
        try:
            return f(x)
        except:
            pass
    assert False


def to_enum(c: Type[EnumT], x: Any) -> EnumT:
    assert isinstance(x, c)
    return x.value


def to_class(c: Type[T], x: Any) -> dict:
    assert isinstance(x, c)
    return cast(Any, x).to_dict()


@dataclass
class NotificationMetadata:
    """The notification's metadata."""

    applicationId: str
    """The application identifier."""

    notificationId: str
    """The notification identifier."""

    publishTime: str
    """The time the notification was published in ISO 8601 format."""

    subscriptionId: str
    """The subscription identifier."""

    @staticmethod
    def from_dict(obj: Any) -> 'NotificationMetadata':
        assert isinstance(obj, dict)
        applicationId = from_str(obj.get("applicationId"))
        notificationId = from_str(obj.get("notificationId"))
        publishTime = from_str(obj.get("publishTime"))
        subscriptionId = from_str(obj.get("subscriptionId"))
        return NotificationMetadata(applicationId, notificationId, publishTime, subscriptionId)

@dataclass
class Pagination:
    """When a query produces results that are not included in the data document, pagination
    occurs. This means that results are divided into pages. To retrieve the next page, you
    must pass a `CreateQuerySpecification` object with `paginationToken` set to this object's
    `nextToken` and with `query` set to this object's `query` in the subsequent `createQuery`
    request. When there are no more pages to fetch, the `nextToken` field will be absent.
    """
    nextToken: Optional[str] = None
    """A token that can be used to fetch the next page of results."""

    @staticmethod
    def from_dict(obj: Any) -> 'Pagination':
        assert isinstance(obj, dict)
        nextToken = from_union([from_str, from_none], obj.get("nextToken"))
        return Pagination(nextToken)

class ProcessingStatus(Enum):
    """The processing status of the query."""

    CANCELLED = "CANCELLED"
    DONE = "DONE"
    FATAL = "FATAL"


@dataclass
class Payload:
    """The Data Kiosk query processing notification payload."""

    accountId: str
    """The merchant customer identifier or vendor group identifier of the selling partner
    account on whose behalf the query was submitted.
    """
    processingStatus: ProcessingStatus
    """The processing status of the query."""

    query: str
    """The submitted query."""

    queryId: str
    """The query identifier. This identifier is unique only in combination with the `accountId`."""

    dataDocumentId: Optional[str] = None
    """The data document identifier. This document identifier is only present when there is data
    available as a result of the query. This identifier is unique only in combination with
    the `accountId`. Pass this identifier into the `getDocument` operation to get the
    information required to retrieve the data document's contents.
    """
    errorDocumentId: Optional[str] = None
    """The error document identifier. This document identifier is only present when an error
    occurs during query processing. This identifier is unique only in combination with the
    `accountId`. Pass this identifier into the `getDocument` operation to get the information
    required to retrieve the error document's contents.
    """
    pagination: Optional[Pagination] = None
    """When a query produces results that are not included in the data document, pagination
    occurs. This means that results are divided into pages. To retrieve the next page, you
    must pass a `CreateQuerySpecification` object with `paginationToken` set to this object's
    `nextToken` and with `query` set to this object's `query` in the subsequent `createQuery`
    request. When there are no more pages to fetch, the `nextToken` field will be absent.
    """

    @staticmethod
    def from_dict(obj: Any) -> 'Payload':
        assert isinstance(obj, dict)
        accountId = from_str(obj.get("accountId"))
        processingStatus = ProcessingStatus(obj.get("processingStatus"))
        query = from_str(obj.get("query"))
        queryId = from_str(obj.get("queryId"))
        dataDocumentId = from_union([from_str, from_none], obj.get("dataDocumentId"))
        errorDocumentId = from_union([from_str, from_none], obj.get("errorDocumentId"))
        pagination = from_union([Pagination.from_dict, from_none], obj.get("pagination"))
        return Payload(accountId, processingStatus, query, queryId, dataDocumentId, errorDocumentId, pagination)

@dataclass
class DataKioskQueryProcessingFinishedNotification:
    """This notification is delivered when a Data Kiosk query finishes processing."""

    eventTime: str
    """The time the notification was sent in ISO 8601 format."""

    notificationMetadata: NotificationMetadata
    """The notification's metadata."""

    notificationType: str
    """The notification type."""

    notificationVersion: str
    """The notification version."""

    payload: Payload
    """The Data Kiosk query processing notification payload."""

    payloadVersion: str
    """The payload version of the notification."""

    @staticmethod
    def from_dict(obj: Any) -> 'DataKioskQueryProcessingFinishedNotification':
        assert isinstance(obj, dict)
        eventTime = from_str(obj.get("eventTime"))
        notificationMetadata = NotificationMetadata.from_dict(obj.get("notificationMetadata"))
        notificationType = from_str(obj.get("notificationType"))
        notificationVersion = from_str(obj.get("notificationVersion"))
        payload = Payload.from_dict(obj.get("payload"))
        payloadVersion = from_str(obj.get("payloadVersion"))
        return DataKioskQueryProcessingFinishedNotification(eventTime, notificationMetadata, notificationType, notificationVersion, payload, payloadVersion)
