package vendorretailprocurement.orders;

import util.RecipeTest;
import java.util.List;

public class GetPurchaseOrderRecipeTest extends RecipeTest {
    public GetPurchaseOrderRecipeTest() {
        super(new GetPurchaseOrderRecipe(), List.of("vendororders-getPurchaseOrder"));
    }
}
