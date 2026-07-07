from src.recipes.vendor_retail_procurement.invoices.submit_invoices_recipe import (
    SubmitInvoicesRecipe,
)
from tests.recipe_test import RecipeTest


class TestSubmitInvoicesRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            SubmitInvoicesRecipe(),
            ["vendorinvoices-submitInvoices"],
        )


def test_submit_invoices() -> None:
    test = TestSubmitInvoicesRecipe()
    test.test_recipe()
