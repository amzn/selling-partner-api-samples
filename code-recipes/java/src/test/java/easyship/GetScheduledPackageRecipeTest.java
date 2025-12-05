package easyship;

import util.RecipeTest;

import java.util.List;

public class GetScheduledPackageRecipeTest extends RecipeTest {

    protected GetScheduledPackageRecipeTest() {
        super(
                new GetScheduledPackageRecipe(),
                List.of(
                    "easyship-getScheduledPackage"
                )
        );
    }
}
