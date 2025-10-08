package aplus;

import util.RecipeTest;

import java.util.List;

public class UploadImageForResouceTest extends RecipeTest {

    protected UploadImageForResouceTest() {
        super(
                new UploadImageForResouceRecipe(),
                List.of(
                    "aplus-createUploadDestinationResponse"
                )
        );
    }
}