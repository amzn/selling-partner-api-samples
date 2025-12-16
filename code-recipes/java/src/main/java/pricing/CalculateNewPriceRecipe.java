package pricing;

import util.Recipe;

import java.math.BigDecimal;

/**
 * Pricing API Recipe: Calculate New Price
 * ========================================
 * 
 * Steps:
 * 1. Calculate SKU landed price
 * 2. Compare buy box price against minimum threshold
 * 3. Calculate new price based on price change rule
 * 4. Validate new price against minimum threshold
 */
public class CalculateNewPriceRecipe extends Recipe {

    @Override
    protected void start() {
        float listingPrice = 29.99f;
        float shippingPrice = 0.00f;
        float buyBoxPrice = 27.99f;
        float minThreshold = 20.00f;
        String priceChangeRule = "PERCENTAGE";
        float priceChangeValue = 5.0f;
        
        System.out.println("[Step 1] Calculating landed price");
        float landedPrice = listingPrice + shippingPrice;
        
        if (buyBoxPrice < minThreshold) {
            System.out.println("[Step 2] Buy Box Price is less than threshold, skipping");
            return;
        }
        
        if (buyBoxPrice > landedPrice) {
            System.out.println("[Step 2] Landed Price is already less than Buy Box Price, skipping");
            return;
        }
        
        System.out.println("[Step 3] Calculating new price using " + priceChangeRule + " rule");
        float newItemPrice;
        float buyBoxPriceExcludingShipping = buyBoxPrice - shippingPrice;
        
        if ("PERCENTAGE".equals(priceChangeRule)) {
            newItemPrice = subtractPercentage(buyBoxPriceExcludingShipping, priceChangeValue);
        } else if ("FIXED".equals(priceChangeRule)) {
            newItemPrice = subtractFixed(buyBoxPriceExcludingShipping, priceChangeValue);
        } else {
            System.out.println("Invalid price change rule");
            return;
        }
        
        if (newItemPrice < minThreshold) {
            System.out.println("[Step 4] New price is less than threshold, skipping");
            return;
        }
        
        System.out.println("[Step 4] New listing price: " + newItemPrice);
    }
    
    private float subtractPercentage(float n1, float percentage) {
        return BigDecimal.valueOf(n1)
                .subtract(BigDecimal.valueOf(n1).multiply(BigDecimal.valueOf(percentage / 100)))
                .floatValue();
    }
    
    private float subtractFixed(float n1, float n2) {
        return BigDecimal.valueOf(n1).subtract(BigDecimal.valueOf(n2)).floatValue();
    }
}
