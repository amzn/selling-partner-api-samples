package easyship;

import util.RecipeTest;

import java.util.List;

public class GetFeedDocumentRecipeTest extends RecipeTest {

    protected GetFeedDocumentRecipeTest() {
        super(
                new GetFeedDocumentRecipe(),
                List.of(
                    "feeds-getFeed",
                    "feeds-getFeedDocument",
                    ""
                )
        );
    }
}
