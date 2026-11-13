package reports;

import util.RecipeTest;

import java.util.List;

public class RequestAndRetrieveReportRecipeTest extends RecipeTest {

    protected RequestAndRetrieveReportRecipeTest() {
        super(
                new RequestAndRetrieveReportRecipe(),
                List.of(
                        "reports-createReport",
                        "reports-getReportDocument"
                )
        );
    }
}
