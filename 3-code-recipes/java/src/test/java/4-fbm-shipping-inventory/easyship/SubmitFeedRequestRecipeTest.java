package easyship;

import util.RecipeTest;

import java.util.List;

public class SubmitFeedRequestRecipeTest extends RecipeTest {

    protected SubmitFeedRequestRecipeTest() {
        super(
                new SubmitFeedRequestRecipe(),
                List.of(
                    "feeds-createFeedDocument",
                    "feeds-createFeed",
                    "feeds-createFeed"
                )
        );
    }
}
