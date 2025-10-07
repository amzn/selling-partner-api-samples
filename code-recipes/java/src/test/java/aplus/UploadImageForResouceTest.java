package aplus;

import util.RecipeTest;

import java.util.List;

public class UploadImageForResouceTest extends RecipeTest {

    protected UploadImageForResouceTest() {
        super(
                new UploadImageForResouce(),
                List.of(
                    "",
                    "",
                    "uploads-createUploadDestination",
                    "",
                    ""
                )
        );
    }
}