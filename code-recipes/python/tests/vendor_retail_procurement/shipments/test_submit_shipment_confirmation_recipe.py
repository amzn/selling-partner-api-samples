from src.recipes.vendor_retail_procurement.shipments.submit_shipment_confirmation_recipe import (
    SubmitShipmentConfirmationRecipe,
)
from tests.recipe_test import RecipeTest


class TestSubmitShipmentConfirmationRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            SubmitShipmentConfirmationRecipe(),
            ["vendorshipments-submitShipmentConfirmation"],
        )


def test_submit_shipment_confirmation() -> None:
    test = TestSubmitShipmentConfirmationRecipe()
    test.test_recipe()
