package b2bdeliveryexperience;

import util.RecipeTest;

import java.util.List;

public class BusinessDeliveryExperienceRecipeTest extends RecipeTest {

    protected BusinessDeliveryExperienceRecipeTest() {
        super(
                new BusinessDeliveryExperienceRecipe(),
                List.of(
                        "orders-getOrder",
                        "orders-getOrderItems", 
                        "orders-getOrderAddress",
                        "orders-confirmShipment",
                        ""
                )
        );
    }
}