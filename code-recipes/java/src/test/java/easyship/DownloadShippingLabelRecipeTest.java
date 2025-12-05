package easyship;

import util.RecipeTest;

import java.util.List;

public class DownloadShippingLabelRecipeTest extends RecipeTest {

    protected DownloadShippingLabelRecipeTest() {
        super(
                new DownloadShippingLabelRecipe(),
                List.of(
                    "reports-getReport",
                    "reports-getReportDocument",
                    ""
                )
        );
    }
}
