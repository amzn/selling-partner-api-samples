import importlib

RequestAndRetrieveReportRecipe = importlib.import_module(
    "src.recipes.2-reporting-analytics.reports.request_and_retrieve_report_recipe"
).RequestAndRetrieveReportRecipe
from tests.recipe_test import RecipeTest


class TestRequestAndRetrieveReportRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            RequestAndRetrieveReportRecipe(),
            [
                "reports-createReport",
                "reports-getReportDocument",
            ],
        )


def test_request_and_retrieve_report_recipe() -> None:
    test = TestRequestAndRetrieveReportRecipe()
    test.test_recipe()
