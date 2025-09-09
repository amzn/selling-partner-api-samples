package finances;

import util.RecipeTest;

import java.util.List;

public class GetFinancialEventsTest extends RecipeTest {

    protected GetFinancialEventsTest() {
        super(
                new GetFinancialEvents(),
                List.of(
                        "{\"payload\":{\"financialEvents\":{\"shipmentEventList\":[{\"amazonOrderId\":\"123-4567890-1234567\",\"sellerOrderId\":\"SO-12345\",\"postedDate\":\"2025-08-01T10:30:00Z\",\"marketplaceName\":\"Amazon.com\",\"shipmentItemList\":[{\"sellerSKU\":\"TEST-SKU-001\",\"quantityShipped\":2}]}]}}}"
                )
        );
    }
}