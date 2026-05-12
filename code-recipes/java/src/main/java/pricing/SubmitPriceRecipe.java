package pricing;

import com.fasterxml.jackson.jr.ob.JSON;
import software.amazon.spapi.api.listings.items.v2021_08_01.ListingsApi;
import software.amazon.spapi.models.listings.items.v2021_08_01.Item;
import software.amazon.spapi.models.listings.items.v2021_08_01.ListingsItemPatchRequest;
import software.amazon.spapi.models.listings.items.v2021_08_01.ListingsItemSubmissionResponse;
import software.amazon.spapi.models.listings.items.v2021_08_01.PatchOperation;
import util.Recipe;

import java.util.List;
import java.util.Map;

/**
 * Pricing API Recipe: Submit New Price
 * =====================================
 * 
 * Steps:
 * 1. Initialize Listings API client
 * 2. Get current listing item details
 * 3. Extract purchasable offer
 * 4. Update price and submit via patchListingsItem
 */
public class SubmitPriceRecipe extends Recipe {

    private final ListingsApi listingsApi = new ListingsApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(util.Constants.BACKEND_URL)
            .build();

    @Override
    protected void start() {
        try {
            String sellerId = "A3SELLER123";
            String sku = "TEST-SKU-001";
            String marketplaceId = "ATVPDKIKX0DER";
            float newPrice = 26.59f;
            
            System.out.println("[Step 1] Getting listing item for SKU: " + sku);
            
            Item item = listingsApi.getListingsItem(sellerId, sku, List.of(marketplaceId), "en_US", List.of("attributes"));
            
            System.out.println("[Step 2] Extracting purchasable offer");
            Map<String, Object> attributes = JSON.std.mapFrom(JSON.std.asString(item.getAttributes()));
            Map<String, Object> purchasableOffer = (Map<String, Object>) attributes.get("purchasable_offer");
            
            System.out.println("[Step 3] Updating price to: " + newPrice);
            List<Map<String, Object>> offers = (List<Map<String, Object>>) purchasableOffer.get("offers");
            offers.get(0).put("price", Map.of("value_with_tax", newPrice, "currency", "USD"));
            
            PatchOperation patchOp = new PatchOperation();
            patchOp.setOp(PatchOperation.OpEnum.REPLACE);
            patchOp.setPath("/attributes/purchasable_offer");
            patchOp.setValue(List.of(Map.of("marketplace_id", marketplaceId, "currency", "USD", "our_price", List.of(Map.of("schedule", offers)))));
            
            ListingsItemPatchRequest patchRequest = new ListingsItemPatchRequest();
            patchRequest.setProductType("PRODUCT");
            patchRequest.setPatches(List.of(patchOp));
            
            System.out.println("[Step 4] Submitting price update");
            ListingsItemSubmissionResponse response = listingsApi.patchListingsItem(patchRequest, sellerId, sku, List.of(marketplaceId), null, "en_US", null);
            
            System.out.println("Price update submitted: " + response.getStatus());
            
        } catch (Exception e) {
            System.err.println("Error submitting price: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
}
