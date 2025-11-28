package easyship;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.listings.items.v2021_08_01.ListingsApi;
import software.amazon.spapi.api.orders.v0.OrdersV0Api;
import software.amazon.spapi.models.listings.items.v2021_08_01.Item;
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
 * 1. Get order items to retrieve SKU
 * 2. Get listing item to retrieve package dimensions and fulfillment availability
 * 3. Calculate total weight and dimensions
 */
public class CalculateOrderDimensionsRecipe extends Recipe {

    private OrdersV0Api ordersApi;
    private ListingsApi listingsApi;
    private String amazonOrderId;
    private String marketplaceId;
    private String sellerId;

    @Override
    protected void start() {
        setupOrderDetails();
        initializeApis();
        GetOrderItemsResponse orderItemsResponse = getOrderItems();
        String sku = extractSku(orderItemsResponse);
        Item listingItem = getListingItem(sku);
        calculateDimensions(listingItem, orderItemsResponse);
        System.out.println("✅ Successfully calculated order dimensions");
    }

    private void setupOrderDetails() {
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

    private String extractSku(GetOrderItemsResponse response) {
        OrderItem firstItem = response.getPayload().getOrderItems().get(0);
        String sku = firstItem.getSellerSKU();
        System.out.println("Extracted SKU: " + sku);
        return sku;
    }

    private Item getListingItem(String sku) {
        try {
            Item response = listingsApi.getListingsItem(sellerId, sku, List.of(marketplaceId), null, List.of("attributes", "fulfillmentAvailability"));
            System.out.println("Listing item retrieved for SKU: " + sku);
            return response;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get listing item", e);
        }
    }

    private void calculateDimensions(Item listingItem, GetOrderItemsResponse orderItemsResponse) {
        Map<String, Object> attributes = listingItem.getAttributes();
        if (attributes == null) {
            System.out.println("No attributes found");
            return;
        }
        int quantity = orderItemsResponse.getPayload().getOrderItems().get(0).getQuantityOrdered();
        
        Map<String, BigDecimal> dimensions = extractPackageDimensions(attributes);
        BigDecimal weight = extractPackageWeight(attributes);
        BigDecimal totalWeight = weight.multiply(BigDecimal.valueOf(quantity));
        
        System.out.println("Package Dimensions:");
        System.out.println("  Length: " + dimensions.get("length") + " cm");
        System.out.println("  Width: " + dimensions.get("width") + " cm");
        System.out.println("  Height: " + dimensions.get("height") + " cm");
        System.out.println("  Weight per unit: " + weight + " g");
        System.out.println("  Total weight (quantity " + quantity + "): " + totalWeight + " g");
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
