package pricing;

import software.amazon.spapi.api.pricing.v0.ProductPricingApi;
import software.amazon.spapi.models.pricing.v0.GetPricingResponse;
import util.Recipe;

import java.util.List;

/**
 * Pricing API Recipe: Fetch Price
 * ================================
 * 
 * Steps:
 * 1. Initialize Pricing API client
 * 2. Call getPricing operation with SKU
 * 3. Extract listing and shipping prices
 */
public class FetchPriceRecipe extends Recipe {

    private final ProductPricingApi pricingApi = new ProductPricingApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(util.Constants.BACKEND_URL)
            .build();

    @Override
    protected void start() {
        try {
            String sku = "TEST-SKU-001";
            String marketplaceId = "ATVPDKIKX0DER";
            
            System.out.println("[Step 1] Calling getPricing for SKU: " + sku);
            
            GetPricingResponse response = pricingApi.getPricing(marketplaceId, "Sku", null, List.of(sku), null, null);
            
            if ("ClientError".equals(response.getPayload().get(0).getStatus())) {
                System.out.println("[Step 2] ClientError received from Pricing API");
                return;
            }
            
            var prices = response.getPayload().get(0).getProduct().getOffers().get(0).getBuyingPrice();
            float listingPrice = prices.getLandedPrice().getAmount().floatValue();
            float shippingPrice = prices.getShipping().getAmount().floatValue();
            
            System.out.println("[Step 3] Listing Price: " + listingPrice + ", Shipping Price: " + shippingPrice);
            
        } catch (Exception e) {
            System.err.println("Error fetching price: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
}
