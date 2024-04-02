from typing import List, Optional

from dataclasses import dataclass

from src.api_models.shipping_api.swagger_client.models.document_format import DocumentFormat
from src.api_models.shipping_api.swagger_client.models.document_size import DocumentSize
from src.api_models.shipping_api.swagger_client.models.print_option import PrintOption


@dataclass
class Credentials:
    orderId: Optional[str] = None
    oneClickShipment: Optional[str] = None


@dataclass
class Currency:
    value: Optional[float] = None
    unit: Optional[str] = None


@dataclass
class Dimensions:
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    unit: Optional[str] = None


@dataclass
class Weight:
    unit: Optional[str] = None
    value: Optional[float] = None


@dataclass
class TimeWindow:
    start: Optional[str] = None
    end: Optional[str] = None


@dataclass
class Promise:
    deliveryWindow: Optional[TimeWindow] = None
    pickupWindow: Optional[TimeWindow] = None

    def __post_init__(self):
        if isinstance(self.deliveryWindow, dict):
            self.deliveryWindow = TimeWindow(**self.deliveryWindow)
        if isinstance(self.pickupWindow, dict):
            self.pickupWindow = TimeWindow(**self.pickupWindow)


@dataclass
class Address:
    name: Optional[str] = None
    addressLine1: Optional[str] = None
    addressLine2: Optional[str] = None
    addressLine3: Optional[str] = None
    city: Optional[str] = None
    countryCode: Optional[str] = None
    postalCode: Optional[str] = None
    companyName: Optional[str] = None
    stateOrRegion: Optional[str] = None
    email: Optional[str] = None
    phoneNumber: Optional[str] = None
    geocode: Optional[str] = None


@dataclass
class Label:
    labelFormat: Optional[DocumentFormat] = None
    dimensions: Optional[DocumentSize] = None
    fileContents: Optional[str] = None


@dataclass
class SupportedDocumentSpecification:
    format: Optional[DocumentFormat] = None
    size: Optional[DocumentSize] = None
    printOptions: Optional[List[PrintOption]] = None


@dataclass
class Rate:
    rateId: Optional[str] = None
    carrierId: Optional[str] = None
    carrierName: Optional[str] = None
    serviceId: Optional[str] = None
    serviceName: Optional[str] = None
    totalCharge: Optional[Currency] = None
    promise: Optional[Promise] = None
    requiresAdditionalInputs: Optional[bool] = None
    supportedDocumentSpecifications: Optional[List[SupportedDocumentSpecification]] = None
    availableValueAddedServiceGroups: Optional[str] = None
    benefits: Optional[str] = None
    billedWeight: Optional[str] = None
    paymentType: Optional[str] = None
    rateItemList: Optional[str] = None
    additionalInput: Optional[dict] = None

    def __post_init__(self):
        if isinstance(self.totalCharge, dict):
            self.totalCharge = Currency(**self.totalCharge)
        if isinstance(self.promise, dict):
            self.promise = Promise(**self.promise)
        if isinstance(self.supportedDocumentSpecifications, dict) or isinstance(self.supportedDocumentSpecifications, list):
            self.supportedDocumentSpecifications = [SupportedDocumentSpecification(**item) for item in self.supportedDocumentSpecifications]


@dataclass
class Rates:
    rates: Optional[List[Rate]] = None
    preferredRate: Optional[Rate] = None
    requiresAdditionalInputs: Optional[bool] = None
    requestToken: Optional[str] = None

    def __post_init__(self):
        if isinstance(self.rates, dict) or isinstance(self.rates, list):
            self.rates = [Rate(**item) for item in self.rates]
        if isinstance(self.preferredRate, dict):
            self.preferredRate = Rate(**self.preferredRate)


@dataclass
class OrderItem:
    orderItemId: Optional[str] = None
    sku: Optional[str] = None
    quantity: Optional[int] = None
    dimensions: Optional[Dimensions] = None
    itemWeight: Optional[Weight] = None
    value: Optional[Currency] = None

    def __post_init__(self):
        if isinstance(self.dimensions, dict):
            self.dimensions = Dimensions(**self.dimensions)
        if isinstance(self.itemWeight, dict):
            self.itemWeight = Weight(**self.itemWeight)
        if isinstance(self.value, dict):
            self.value = Currency(**self.value)


@dataclass
class MfnOrder:
    orderItems: Optional[List[OrderItem]] = None
    shipFromAddress: Optional[Address] = None
    shipToAddress: Optional[Address] = None
    dimensions: Optional[Dimensions] = None
    weight: Optional[Weight] = None

    def __post_init__(self):
        if isinstance(self.dimensions, dict):
            self.dimensions = Dimensions(**self.dimensions)
        if isinstance(self.weight, dict):
            self.weight = Weight(**self.weight)
        if isinstance(self.shipFromAddress, dict):
            self.shipFromAddress = Address(**self.shipFromAddress)
        if isinstance(self.shipToAddress, dict):
            self.shipToAddress = Address(**self.shipToAddress)
        if isinstance(self.orderItems, dict) or isinstance(self.orderItems, list):
            self.orderItems = [OrderItem(**item) for item in self.orderItems]


@dataclass
class ShippingLambdaInput:
    mfnOrder: Optional[MfnOrder] = None
    credentials: Optional[Credentials] = None
    rates: Optional[Rates] = None
    label: Optional[Label] = None

    def __post_init__(self):
        if isinstance(self.mfnOrder, dict):
            self.mfnOrder = MfnOrder(**self.mfnOrder)
        if isinstance(self.credentials, dict):
            self.credentials = Credentials(**self.credentials)
        if isinstance(self.rates, dict):
            self.rates = Rates(**self.rates)
        if isinstance(self.label, dict):
            self.label = Label(**self.label)