package vendorretailprocurement.transaction;

import util.RecipeTest;
import java.util.List;

public class GetTransactionRecipeTest extends RecipeTest {
    public GetTransactionRecipeTest() {
        super(new GetTransactionRecipe(), List.of("vendortransaction-getTransaction"));
    }
}
