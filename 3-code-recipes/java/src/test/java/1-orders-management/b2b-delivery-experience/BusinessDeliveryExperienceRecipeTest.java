package b2bdeliveryexperience;

import util.RecipeTest;

import java.util.List;

public class BusinessDeliveryExperienceRecipeTest extends RecipeTest {

    protected BusinessDeliveryExperienceRecipeTest() {
        super(
                new BusinessDeliveryExperienceRecipe(),
                List.of(
                        "orders-getOrder",
                        "orders-getOrderBuyerInfo",
                        "orders-getOrderItems", 
                        "orders-getOrderAddress",
                        "orders-confirmShipment",
                        ""
                )
        );
    }
}