package vendorretailprocurement.orders;

import util.RecipeTest;
import java.util.List;

public class SubmitAcknowledgementRecipeTest extends RecipeTest {
    public SubmitAcknowledgementRecipeTest() {
        super(new SubmitAcknowledgementRecipe(), List.of("vendororders-submitAcknowledgement"));
    }
}
