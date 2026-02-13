package pricing;

import util.Recipe;
import util.notifications.pricing.AnyOfferChangedNotification;
import util.notifications.pricing.AnyOfferChangedNotificationConverter;
import util.notifications.pricing.AnyOfferChangedNotificationWrapper;
import util.notifications.pricing.OfferElement;

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
            AnyOfferChangedNotificationWrapper notification =
                    AnyOfferChangedNotificationConverter.fromJsonString(Constants.SAMPLE_NOTIFICATION);

            AnyOfferChangedNotification aocNotification = notification.getPayload().getAnyOfferChangedNotification();
            String sellerId = aocNotification.getSellerid();
            String asin = aocNotification.getOfferChangeTrigger().getAsin();
            
            System.out.println("[Step 1] Parsed notification for ASIN: " + asin + ", Seller: " + sellerId);
            
            List<Map<String, Object>> skus = fetchSkusFromDatabase(asin, sellerId);
            System.out.println("[Step 2] Retrieved " + skus.size() + " SKUs from database");
            
            List<SkuResult> results = new ArrayList<>();
            for (Map<String, Object> sku : skus) {
                SkuResult result = processSku(sku, aocNotification.getOffers());
                results.add(result);
                System.out.println("[Step 3] Processed SKU: " + result.sku + 
                    ", FBA: " + result.isFba + 
                    ", Listing Price: " + (result.listingPrice));
            }
            
            System.out.println("[Step 4] Completed processing " + results.size() + " SKUs");
            
        } catch (Exception e) {
            System.err.println("Error processing notification: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }

    private List<Map<String, Object>> fetchSkusFromDatabase(String asin, String sellerId) {
        List<Map<String, Object>> skus = new ArrayList<>();
        skus.add(Map.of("SKU", "TEST-SKU-001", "ASIN", asin, "SellerId", sellerId, "IsFulfilledByAmazon", true));
        skus.add(Map.of("SKU", "TEST-SKU-002", "ASIN", asin, "SellerId", sellerId, "IsFulfilledByAmazon", false));
        return skus;
    }

    private SkuResult processSku(Map<String, Object> sku, List<OfferElement> offers) {
        String skuId = (String) sku.get("SKU");
        Boolean isFbaObj = (Boolean) sku.get("IsFulfilledByAmazon");
        boolean isFba = isFbaObj != null && isFbaObj;
        
        // Find matching offer by fulfillment type
        OfferElement matchingOffer = findMatchingOffer(offers, isFba);
        
        SkuResult result = new SkuResult();
        result.sku = skuId;
        result.isFba = isFba;
        
        if (matchingOffer != null) {
            result.listingPrice = matchingOffer.getListingPrice().getAmount();
            result.shippingPrice = matchingOffer.getShipping().getAmount();
        }
        
        return result;
    }

    private OfferElement findMatchingOffer(List<OfferElement> offers, boolean isFba) {
        for (OfferElement offer : offers) {
            if (offer.getIsFulfilledByAmazon() == isFba) {
                return offer;
            }
        }
        return null;
    }

    private static class SkuResult {
        String sku;
        boolean isFba;
        double listingPrice;
        double shippingPrice;
    }
}