package aplus;

import util.RecipeTest;

import java.util.List;

public class UploadImageForResourceTest extends RecipeTest {

    protected UploadImageForResourceTest() {
        super(
                new UploadImageForResourceRecipe(),
                List.of(
                    "aplus-createUploadDestinationResponse"
                )
        );
    }
}