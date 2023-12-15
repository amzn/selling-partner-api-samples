from src.utils import constants

from dataclasses import dataclass
from typing import Optional, List
import re


@dataclass
class Money:
    currency_code: str = None
    amount: float = None


@dataclass
class BuyBox:
    condition: str = None
    price: Optional[Money] = None

    def __post_init__(self):
        if isinstance(self.price, dict):
            self.price = Money(**self.price)


@dataclass
class SellerOffer:
    isFulfilledByAmazon: Optional[bool] = None
    isBuyBoxWinner: Optional[bool] = None
    listingPrice: Optional[Money] = None
    shippingPrice: Optional[Money] = None

    def __post_init__(self):
        if isinstance(self.listingPrice, dict):
            self.listingPrice = Money(**self.listingPrice)
        if isinstance(self.shippingPrice, dict):
            self.shippingPrice = Money(**self.shippingPrice)


@dataclass
class Seller:
    sellerId: str = None
    offers: Optional[List[SellerOffer]] = None

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
    sellerOffer: Optional[SellerOffer] = None
    minThreshold: Optional[float] = None
    newListingPrice: Optional[Money] = None
    itemSku: Optional[str] = None
    asin: Optional[str] = None
    sellerId: Optional[str] = None
    seller: Optional[Seller] = None
    credentials: Optional[Credentials] = None
    isFulfilledByAmazon: Optional[bool] = None
    isBuyBoxWinner: Optional[bool] = None
    priceChangeRule: Optional[PriceChangeRule] = None

    def __post_init__(self):
        if isinstance(self.buyBox, dict):
            self.buyBox = BuyBox(**self.buyBox)
        if isinstance(self.sellerOffer, dict):
            self.sellerOffer = SellerOffer(**self.sellerOffer)
        if isinstance(self.newListingPrice, dict):
            self.newListingPrice = Money(**self.newListingPrice)
        if isinstance(self.priceChangeRule, dict):
            self.priceChangeRule = PriceChangeRule(**self.priceChangeRule)
        if isinstance(self.credentials, dict):
            self.credentials = Credentials(**self.credentials)
        if isinstance(self.seller, dict):
            self.seller = Seller(**self.seller)


def camel_to_snake_case_dict(input_dict):
    output_dict = {}
    for key, value in input_dict.items():
        snake_case_key = re.sub('([a-z0-9])([A-Z])', r'\1_\2', key).lower()
        output_dict[snake_case_key] = value
    return output_dict