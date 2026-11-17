import importlib

SubmitAcknowledgementRecipe = importlib.import_module(
    "src.recipes.3-vendor-retail-procurement.orders.submit_acknowledgement_recipe"
).SubmitAcknowledgementRecipe
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
