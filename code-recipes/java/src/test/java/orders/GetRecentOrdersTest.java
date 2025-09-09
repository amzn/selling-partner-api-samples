package orders;

import util.RecipeTest;

import java.util.List;

public class GetRecentOrdersTest extends RecipeTest {

    protected GetRecentOrdersTest() {
        super(
                new GetRecentOrders(),
                List.of(
                        "{\"payload\":{\"orders\":[{\"amazonOrderId\":\"123-4567890-1234567\",\"orderStatus\":\"Shipped\",\"orderTotal\":{\"amount\":\"29.99\",\"currencyCode\":\"USD\"},\"purchaseDate\":\"2025-08-01T10:30:00Z\",\"numberOfItemsShipped\":1,\"numberOfItemsUnshipped\":0}]}}"
                )
        );
    }
}