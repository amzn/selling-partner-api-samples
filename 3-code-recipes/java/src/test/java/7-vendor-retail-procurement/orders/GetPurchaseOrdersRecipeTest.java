package vendorretailprocurement.orders;

import util.RecipeTest;
import java.util.List;

public class GetPurchaseOrdersRecipeTest extends RecipeTest {
    public GetPurchaseOrdersRecipeTest() {
        super(
            new GetPurchaseOrdersRecipe(),
            List.of("vendororders-getPurchaseOrders", "vendororders-getPurchaseOrders")
        );
    }
}
