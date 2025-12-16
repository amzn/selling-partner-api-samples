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
            Map<String, Object> notification = parseNotification(Constants.SAMPLE_NOTIFICATION);
            
            String sellerId = extractSellerId(notification);
            String asin = extractAsin(notification);
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

    private Map<String, Object> parseNotification(String notificationJson) throws Exception {
        return JSON.std.mapFrom(notificationJson);
    }

    private String extractSellerId(Map<String, Object> notification) {
        Map<String, Object> payload = asMap(notification.get("Payload"));
        Map<String, Object> offerPayload = asMap(payload.get("AnyOfferChangedNotification"));
        return asString(offerPayload.get("SellerId"));
    }

    private String extractAsin(Map<String, Object> notification) {
        Map<String, Object> payload = asMap(notification.get("Payload"));
        Map<String, Object> offerPayload = asMap(payload.get("AnyOfferChangedNotification"));
        Map<String, Object> trigger = asMap(offerPayload.get("OfferChangeTrigger"));
        return asString(trigger.get("ASIN"));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractOffers(Map<String, Object> notification) {
        Map<String, Object> payload = asMap(notification.get("Payload"));
        Map<String, Object> offerPayload = asMap(payload.get("AnyOfferChangedNotification"));
        Object offersObj = offerPayload.get("Offers");
        if (offersObj instanceof List<?>) {
            return (List<Map<String, Object>>) offersObj;
        }
        return new ArrayList<>();
    }

    private List<Map<String, Object>> fetchSkusFromDatabase(String asin, String sellerId) {
        List<Map<String, Object>> skus = new ArrayList<>();
        skus.add(Map.of("SKU", "TEST-SKU-001", "ASIN", asin, "SellerId", sellerId, "IsFulfilledByAmazon", true));
        skus.add(Map.of("SKU", "TEST-SKU-002", "ASIN", asin, "SellerId", sellerId, "IsFulfilledByAmazon", false));
        return skus;
    }

    private SkuResult processSku(Map<String, Object> sku, List<Map<String, Object>> offers) {
        String skuId = asString(sku.get("SKU"));
        boolean isFba = asBoolean(sku.get("IsFulfilledByAmazon"));
        
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

    private Map<String, Object> findMatchingOffer(List<Map<String, Object>> offers, boolean isFba) {
        for (Map<String, Object> offer : offers) {
            if (asBoolean(offer.get("IsFulfilledByAmazon")) == isFba) {
                return offer;
            }
        }
        return null;
    }

    private Float extractPrice(Map<String, Object> offer, String priceField) {
        Map<String, Object> price = asMap(offer.get(priceField));
        if (price != null && price.containsKey("Amount")) {
            return asFloat(price.get("Amount"));
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }

    private String asString(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private boolean asBoolean(Object value) {
        if (value instanceof Boolean) return (Boolean) value;
        if (value instanceof String) return Boolean.parseBoolean((String) value);
        return false;
    }

    private Float asFloat(Object value) {
        if (value instanceof Number) return ((Number) value).floatValue();
        if (value instanceof String) return Float.parseFloat((String) value);
        return null;
    }

    private static class SkuResult {
        String sku;
        boolean isFba;
        Float listingPrice;
        Float shippingPrice;
    }
}
