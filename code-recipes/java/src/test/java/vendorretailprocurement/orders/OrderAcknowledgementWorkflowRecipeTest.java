package vendorretailprocurement.orders;

import util.RecipeTest;
import java.util.List;

public class OrderAcknowledgementWorkflowRecipeTest extends RecipeTest {
    public OrderAcknowledgementWorkflowRecipeTest() {
        super(
            new OrderAcknowledgementWorkflowRecipe(),
            List.of(
                "vendororders-getPurchaseOrders",
                "vendororders-getPurchaseOrder",
                "vendororders-submitAcknowledgement",
                "vendortransaction-getTransaction"
            )
        );
    }
}
