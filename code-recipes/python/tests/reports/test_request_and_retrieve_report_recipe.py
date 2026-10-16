from src.recipes.reports.request_and_retrieve_report_recipe import (
    RequestAndRetrieveReportRecipe,
)
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
