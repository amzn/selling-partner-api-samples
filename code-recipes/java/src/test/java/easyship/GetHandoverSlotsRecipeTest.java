package easyship;

import util.RecipeTest;

import java.util.List;

public class GetHandoverSlotsRecipeTest extends RecipeTest {

    protected GetHandoverSlotsRecipeTest() {
        super(
                new GetHandoverSlotsRecipe(),
                List.of(
                    "easyship-listHandoverSlots"
                )
        );
    }
}
