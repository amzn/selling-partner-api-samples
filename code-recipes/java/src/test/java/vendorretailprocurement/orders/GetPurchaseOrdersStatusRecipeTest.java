package vendorretailprocurement.orders;

import util.RecipeTest;
import java.util.List;

public class GetPurchaseOrdersStatusRecipeTest extends RecipeTest {
    public GetPurchaseOrdersStatusRecipeTest() {
        super(new GetPurchaseOrdersStatusRecipe(), List.of(
                "vendororders-getPurchaseOrdersStatus",  // For getOrderStatusByDateRange
                "vendororders-getPurchaseOrdersStatus"   // For getOrderStatusByPONumber
        ));
    }
}
