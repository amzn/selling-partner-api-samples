package notifications;

import util.RecipeTest;

import java.util.List;

public class CreateSubscriptionRecipeTest extends RecipeTest {

    protected CreateSubscriptionRecipeTest() {
        super(
                new CreateSubscriptionRecipe(),
                List.of(
                    "notifications-createSubscription"
                )
        );
    }
}
