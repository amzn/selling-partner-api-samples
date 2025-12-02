package easyship;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.catalogitems.v2022_04_01.CatalogApi;
import software.amazon.spapi.api.listings.items.v2021_08_01.ListingsApi;
import software.amazon.spapi.api.orders.v0.OrdersV0Api;
import software.amazon.spapi.models.orders.v0.GetOrderItemsResponse;
import software.amazon.spapi.models.orders.v0.OrderItem;
import util.Constants;
import util.Recipe;

import com.amazon.SellingPartnerAPIAA.LWAException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Code Recipe to calculate order weight and dimensions for EasyShip
 * Steps:
 * 1. Get order items to retrieve all SKUs
 * 2. For each SKU, search Catalog Items API for ASIN dimensions
 * 3. Fallback to Listings Items API if dimensions not available
 * 4. Sum all weights and dimensions
 * 
 * IMPORTANT: Neither APIs guarantees 100% of data availability.
 */
public class CalculateOrderDimensionsRecipe extends Recipe {

    private OrdersV0Api ordersApi;
    private CatalogApi catalogApi;
    private ListingsApi listingsApi;
    private String amazonOrderId;
    private String marketplaceId;
    private String sellerId;

    @Override
    protected void start() {
        setupOrderDetails();
        initializeApis();
        GetOrderItemsResponse orderItemsResponse = getOrderItems();
        calculateTotalDimensions(orderItemsResponse);
        System.out.println("✅ Successfully calculated order dimensions");
    }

    private void setupOrderDetails() {
        // IMPORTANT: Replace these sample values with actual values from your environment
        // These IDs are for demonstration purposes only
        amazonOrderId = "702-3035602-4225066";
        marketplaceId = "A1AM78C64UM0Y8";
        sellerId = "A2ZPJ4TLUOSWY8";
        System.out.println("Order details configured: " + amazonOrderId);
    }

    private void initializeApis() {
        ordersApi = new OrdersV0Api.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        
        catalogApi = new CatalogApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        
        listingsApi = new ListingsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        
        System.out.println("APIs initialized");
    }

    private GetOrderItemsResponse getOrderItems() {
        try {
            GetOrderItemsResponse response = ordersApi.getOrderItems(amazonOrderId, null);
            System.out.println("Order items retrieved: " + response.getPayload().getOrderItems().size() + " items");
            return response;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get order items", e);
        }
    }

    private void calculateTotalDimensions(GetOrderItemsResponse orderItemsResponse) {
        BigDecimal totalWeight = BigDecimal.ZERO;
        BigDecimal totalLength = BigDecimal.ZERO;
        BigDecimal totalWidth = BigDecimal.ZERO;
        BigDecimal totalHeight = BigDecimal.ZERO;
        
        for (OrderItem orderItem : orderItemsResponse.getPayload().getOrderItems()) {
            String sku = orderItem.getSellerSKU();
            String asin = orderItem.getASIN();
            int quantity = orderItem.getQuantityOrdered();
            
            System.out.println("Processing SKU: " + sku + ", ASIN: " + asin + ", Quantity: " + quantity);
            
            Map<String, Object> attributes = getDimensionsFromCatalog(asin);
            if (attributes == null) {
                attributes = getDimensionsFromListings(sku);
            }
            
            if (attributes != null) {
                Map<String, BigDecimal> dimensions = extractPackageDimensions(attributes);
                BigDecimal weight = extractPackageWeight(attributes);
                
                totalWeight = totalWeight.add(weight.multiply(BigDecimal.valueOf(quantity)));
                totalLength = totalLength.add(dimensions.get("length").multiply(BigDecimal.valueOf(quantity)));
                totalWidth = totalWidth.add(dimensions.get("width").multiply(BigDecimal.valueOf(quantity)));
                totalHeight = totalHeight.add(dimensions.get("height").multiply(BigDecimal.valueOf(quantity)));
            }
        }
        
        System.out.println("\nTotal Order Dimensions:");
        System.out.println("  Total Length: " + totalLength + " cm");
        System.out.println("  Total Width: " + totalWidth + " cm");
        System.out.println("  Total Height: " + totalHeight + " cm");
        System.out.println("  Total Weight: " + totalWeight + " g");
    }
    
    private Map<String, Object> getDimensionsFromCatalog(String asin) {
        try {
            software.amazon.spapi.models.catalogitems.v2022_04_01.Item catalogItem = 
                catalogApi.getCatalogItem(asin, List.of(marketplaceId), List.of("attributes"), null);
            System.out.println("  Retrieved dimensions from Catalog API");
            if (catalogItem.getAttributes() != null) {
                return (Map<String, Object>) catalogItem.getAttributes();
            }
            return null;
        } catch (ApiException | LWAException e) {
            System.out.println("  Catalog API failed, will try Listings API");
            return null;
        }
    }
    
    private Map<String, Object> getDimensionsFromListings(String sku) {
        try {
            software.amazon.spapi.models.listings.items.v2021_08_01.Item listingItem = 
                listingsApi.getListingsItem(sellerId, sku, List.of(marketplaceId), null, List.of("attributes"));
            System.out.println("  Retrieved dimensions from Listings API");
            return listingItem.getAttributes();
        } catch (ApiException | LWAException e) {
            System.out.println("  Failed to retrieve dimensions from Listings API");
            return null;
        }
    }

    private Map<String, BigDecimal> extractPackageDimensions(Map<String, Object> attributes) {
        List<?> packageDimensions = (List<?>) attributes.get("item_package_dimensions");
        if (packageDimensions != null && !packageDimensions.isEmpty()) {
            Map<?, ?> dims = (Map<?, ?>) packageDimensions.get(0);
            return Map.of(
                "length", extractValue((Map<?, ?>) dims.get("length")),
                "width", extractValue((Map<?, ?>) dims.get("width")),
                "height", extractValue((Map<?, ?>) dims.get("height"))
            );
        }
        return Map.of("length", BigDecimal.ZERO, "width", BigDecimal.ZERO, "height", BigDecimal.ZERO);
    }

    private BigDecimal extractPackageWeight(Map<String, Object> attributes) {
        List<?> packageWeight = (List<?>) attributes.get("item_package_weight");
        if (packageWeight != null && !packageWeight.isEmpty()) {
            Map<?, ?> weight = (Map<?, ?>) packageWeight.get(0);
            return extractValue(weight);
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal extractValue(Map<?, ?> map) {
        if (map != null && map.containsKey("value")) {
            Object value = map.get("value");
            if (value instanceof Number) {
                return BigDecimal.valueOf(((Number) value).doubleValue());
            }
        }
        return BigDecimal.ZERO;
    }
}
