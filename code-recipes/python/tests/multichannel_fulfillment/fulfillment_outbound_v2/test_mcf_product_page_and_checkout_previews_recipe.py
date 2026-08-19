from src.recipes.multichannel_fulfillment.fulfillment_outbound_v2.mcf_product_page_and_checkout_previews_recipe import (
    McfProductPageAndCheckoutPreviewsRecipe,
)
from tests.recipe_test import RecipeTest


class TestMcfProductPageAndCheckoutPreviewsRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            McfProductPageAndCheckoutPreviewsRecipe(),
            [
                "mcf-v2-getOffers",
                "mcf-v2-getOrderPreview",
            ],
        )


def test_mcf_product_page_and_checkout_previews() -> None:
    test = TestMcfProductPageAndCheckoutPreviewsRecipe()
    test.test_recipe()
