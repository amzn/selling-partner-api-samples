from src.recipes.vendor_retail_procurement.orders.submit_acknowledgement_recipe import (
    SubmitAcknowledgementRecipe,
)
from tests.recipe_test import RecipeTest


class TestSubmitAcknowledgementRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            SubmitAcknowledgementRecipe(),
            ["vendororders-submitAcknowledgement"],
        )


def test_submit_acknowledgement() -> None:
    test = TestSubmitAcknowledgementRecipe()
    test.test_recipe()
