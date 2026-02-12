package notifications;

import util.RecipeTest;

import java.util.List;

public class CreateDestinationRecipeTest extends RecipeTest {

    protected CreateDestinationRecipeTest() {
        super(
                new CreateDestinationRecipe(),
                List.of(
                    "notifications-createDestination"
                )
        );
    }
}
