package datakiosk;

import util.RecipeTest;

import java.util.List;

public class DataKioskQueryRecipeTest extends RecipeTest {

    protected DataKioskQueryRecipeTest() {
        super(
                new DataKioskQueryRecipe(),
                List.of(
                        "datakiosk-createQuery",
                        "datakiosk-getDocument",
                        "datakiosk-document"
                )
        );
    }
}
