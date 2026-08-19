from src.recipes.vendor_retail_procurement.shipments.get_shipment_details_recipe import (
    GetShipmentDetailsRecipe,
)
from tests.recipe_test import RecipeTest


class TestGetShipmentDetailsRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            GetShipmentDetailsRecipe(),
            ["vendorshipments-getShipmentDetails"],
        )


def test_get_shipment_details() -> None:
    test = TestGetShipmentDetailsRecipe()
    test.test_recipe()
