package easyship;

import util.RecipeTest;

import java.util.List;

public class CreateScheduledPackageRecipeTest extends RecipeTest {

    protected CreateScheduledPackageRecipeTest() {
        super(
                new CreateScheduledPackageRecipe(),
                List.of(
                    "easyship-createScheduledPackage"
                )
        );
    }
}
