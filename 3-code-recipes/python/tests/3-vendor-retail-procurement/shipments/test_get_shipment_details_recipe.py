import importlib

GetShipmentDetailsRecipe = importlib.import_module(
    "src.recipes.3-vendor-retail-procurement.shipments.get_shipment_details_recipe"
).GetShipmentDetailsRecipe
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
