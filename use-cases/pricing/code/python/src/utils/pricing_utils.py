from src.utils import constants

from dataclasses import dataclass
from typing import Optional, List
import re


@dataclass
class Money:
    currency_code: str = None
    amount: float = None


@dataclass
class Points:
    pointsNumber: float = None


@dataclass
class BuyBox:
    condition: str = None
    price: Optional[Money] = None

    def __post_init__(self):
        if isinstance(self.price, dict):
            self.price = Money(**self.price)

@dataclass
class CalculateNewPriceResult:
    newListingPrice: Optional[Money] = None

    def __post_init__(self):
        if isinstance(self.newListingPrice, dict):
            self.newListingPrice = Money(**self.newListingPrice)


@dataclass
class ReferencePrice:
    averageSellingPrice: Optional[Money] = None
    competitivePriceThreshold: Optional[Money] = None
    msrpPrice: Optional[Money] = None
    retailOfferPrice: Optional[Money] = None

    def __post_init__(self):

        if isinstance(self.averageSellingPrice, dict):
            self.averageSellingPrice = Money(**self.averageSellingPrice)
        if isinstance(self.competitivePriceThreshold, dict):
            self.competitivePriceThreshold = Money(**self.competitivePriceThreshold)
        if isinstance(self.msrpPrice, dict):
            self.msrpPrice = Money(**self.msrpPrice)
        if isinstance(self.retailOfferPrice, dict):
            self.retailOfferPrice = Money(**self.retailOfferPrice)


@dataclass
class MerchantOffer:
    condition: Optional[str] = None
    fulfillmentType: Optional[str] = None
    listingPrice: Optional[Money] = None
    shippingPrice: Optional[Money] = None
    shipping: Optional[Money] = None
    points: Optional[Points] = None
    landedPrice: Optional[Money] = None

    def __post_init__(self):
        if isinstance(self.listingPrice, dict):
            self.listingPrice = Money(**self.listingPrice)
        if isinstance(self.shippingPrice, dict):
            self.shippingPrice = Money(**self.shippingPrice)
        if isinstance(self.shipping, dict):
            self.shipping = Money(**self.shipping)
        if isinstance(self.points, dict):
            self.points = Points(**self.points)
        if isinstance(self.landedPrice, dict):
            self.landedPrice = Money(**self.landedPrice)


@dataclass
class SellerOffer:
    isFulfilledByAmazon: Optional[bool] = None
    isBuyBoxWinner: Optional[bool] = None
    listingPrice: Optional[Money] = None
    shippingPrice: Optional[Money] = None
    points: Optional[Points] = None
    referencePrice: Optional[ReferencePrice] = None
    # fulfillmentType: Optional[str] = None
    condition: Optional[str] = None
    shipping: Optional[Money] = None
    landedPrice: Optional[Money] = None

    def __post_init__(self):
        if isinstance(self.listingPrice, dict):
            self.listingPrice = Money(**self.listingPrice)
        if isinstance(self.shippingPrice, dict):
            self.shippingPrice = Money(**self.shippingPrice)
        if isinstance(self.points, dict):
            self.points = Points(**self.points)
        if isinstance(self.shipping, dict):
            self.shipping = Money(**self.shipping)
        if isinstance(self.landedPrice, dict):
            self.landedPrice = Money(**self.landedPrice)


@dataclass
class Seller:
    sellerId: str = None
    offers: Optional[List[SellerOffer]] = None
    referencePrice: Optional[ReferencePrice] = None

    def __post_init__(self):
        if isinstance(self.offers, dict) or isinstance(self.offers, list):
            self.offers = [SellerOffer(**offer) for offer in self.offers]


@dataclass
class Credentials:
    refreshToken: str = None
    regionCode: str = None
    marketplaceId: str = None


@dataclass
class PriceChangeRule:
    value: float = None
    rule: str = None

    def __post_init__(self):
        if not any(price_rule.value == self.rule for price_rule in constants.PriceChangeRule):
            raise ValueError(f"Rule must be one of {constants.PriceChangeRule.__members__.values()}")


@dataclass
class PricingOfferLambdaInput:
    buyBox: Optional[BuyBox] = None
    referencePrice: Optional[ReferencePrice] = None
    sellerOffer: Optional[SellerOffer] = None
    minThreshold: Optional[float] = None
    calculateNewPriceResult: Optional[CalculateNewPriceResult] = None
    itemSku: Optional[str] = None
    asin: Optional[str] = None
    sellerId: Optional[str] = None
    seller: Optional[Seller] = None
    credentials: Optional[Credentials] = None
    isFulfilledByAmazon: Optional[bool] = None
    isBuyBoxWinner: Optional[bool] = None
    priceChangeRule: Optional[PriceChangeRule] = None
    fulfillmentType: Optional[str] = None
    useCompetitivePrice: Optional[bool] = None
    newListingPrice: Optional[Money] = None

    def __post_init__(self):
        if isinstance(self.buyBox, dict):
            self.buyBox = BuyBox(**self.buyBox)
        if isinstance(self.sellerOffer, dict):
            self.sellerOffer = SellerOffer(**self.sellerOffer)
        if isinstance(self.calculateNewPriceResult, dict):
            self.calculateNewPriceResult = Money(**self.calculateNewPriceResult)
        if isinstance(self.priceChangeRule, dict):
            self.priceChangeRule = PriceChangeRule(**self.priceChangeRule)
        if isinstance(self.credentials, dict):
            self.credentials = Credentials(**self.credentials)
        if isinstance(self.seller, dict):
            self.seller = Seller(**self.seller)
        if isinstance(self.referencePrice, dict):
            self.referencePrice = ReferencePrice(**self.referencePrice)
        if isinstance(self.newListingPrice, dict):
            self.newListingPrice = Money(**self.newListingPrice)


def camel_to_snake_case_dict(input_dict):
    output_dict = {}
    for key, value in input_dict.items():
        snake_case_key = re.sub('([a-z0-9])([A-Z])', r'\1_\2', key).lower()
        output_dict[snake_case_key] = value
    return output_dict


def pascal_to_camel_case_dict(input_dict):
    output_dict = {}
    for key, value in input_dict.items():
        camel_case_key = re.sub('([a-z0-9])([A-Z])', r'\1\2', key)
        camel_case_key = camel_case_key[0].lower() + camel_case_key[1:]
        output_dict[camel_case_key] = value
    return output_dict
