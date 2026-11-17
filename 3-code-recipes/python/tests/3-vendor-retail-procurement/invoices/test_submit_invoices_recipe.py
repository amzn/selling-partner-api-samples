import importlib

SubmitInvoicesRecipe = importlib.import_module(
    "src.recipes.3-vendor-retail-procurement.invoices.submit_invoices_recipe"
).SubmitInvoicesRecipe
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
