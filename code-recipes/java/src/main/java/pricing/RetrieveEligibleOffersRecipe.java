package pricing;

import com.fasterxml.jackson.jr.ob.JSON;
import util.Recipe;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Pricing API Recipe: Retrieve Eligible Offers
 * =============================================
 * 
 * Steps:
 * 1. Parse the pricing notification
 * 2. Fetch SKUs from database by ASIN
 * 3. Match seller offers with SKUs by fulfillment type
 * 4. Extract pricing information
 */
public class RetrieveEligibleOffersRecipe extends Recipe {

    @Override
    protected void start() {
        try {
            Map<String, Object> notification = JSON.std.mapFrom(Constants.SAMPLE_NOTIFICATION);
            
            String sellerId = "A3SELLER123";
            String asin = "B08N5WRWNW";
            List<Map<String, Object>> offers = extractOffers(notification);
            
            System.out.println("[Step 1] Parsed notification for ASIN: " + asin + ", Seller: " + sellerId);
            
            List<Map<String, Object>> skus = fetchSkusFromDatabase(asin, sellerId);
            System.out.println("[Step 2] Retrieved " + skus.size() + " SKUs from database");
            
            List<SkuResult> results = new ArrayList<>();
            for (Map<String, Object> sku : skus) {
                SkuResult result = processSku(sku, offers);
                results.add(result);
                System.out.println("[Step 3] Processed SKU: " + result.sku + 
                    ", FBA: " + result.isFba + 
                    ", Listing Price: " + (result.listingPrice != null ? result.listingPrice : "N/A"));
            }
            
            System.out.println("[Step 4] Completed processing " + results.size() + " SKUs");
            
        } catch (Exception e) {
            System.err.println("Error processing notification: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractOffers(Map<String, Object> notification) {
        Map<String, Object> payload = (Map<String, Object>) notification.get("Payload");
        Map<String, Object> offerPayload = (Map<String, Object>) payload.get("AnyOfferChangedNotification");
        return (List<Map<String, Object>>) offerPayload.get("Offers");
    }

    private List<Map<String, Object>> fetchSkusFromDatabase(String asin, String sellerId) {
        List<Map<String, Object>> skus = new ArrayList<>();
        skus.add(Map.of("SKU", "TEST-SKU-001", "ASIN", asin, "SellerId", sellerId, "IsFulfilledByAmazon", true));
        skus.add(Map.of("SKU", "TEST-SKU-002", "ASIN", asin, "SellerId", sellerId, "IsFulfilledByAmazon", false));
        return skus;
    }

    private SkuResult processSku(Map<String, Object> sku, List<Map<String, Object>> offers) {
        String skuId = (String) sku.get("SKU");
        Boolean isFbaObj = (Boolean) sku.get("IsFulfilledByAmazon");
        boolean isFba = isFbaObj != null && isFbaObj;
        
        // Find matching offer by fulfillment type
        Map<String, Object> matchingOffer = findMatchingOffer(offers, isFba);
        
        SkuResult result = new SkuResult();
        result.sku = skuId;
        result.isFba = isFba;
        
        if (matchingOffer != null) {
            result.listingPrice = extractPrice(matchingOffer, "ListingPrice");
            result.shippingPrice = extractPrice(matchingOffer, "Shipping");
        }
        
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> findMatchingOffer(List<Map<String, Object>> offers, boolean isFba) {
        for (Map<String, Object> offer : offers) {
            Boolean offerFba = (Boolean) offer.get("IsFulfilledByAmazon");
            if (offerFba != null && offerFba == isFba) {
                return offer;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Float extractPrice(Map<String, Object> offer, String priceField) {
        Map<String, Object> price = (Map<String, Object>) offer.get(priceField);
        if (price != null && price.containsKey("Amount")) {
            Object amount = price.get("Amount");
            return amount instanceof Number ? ((Number) amount).floatValue() : null;
        }
        return null;
    }

    private static class SkuResult {
        String sku;
        boolean isFba;
        Float listingPrice;
        Float shippingPrice;
    }
}
