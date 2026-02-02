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
        BigDecimal listingPrice = new BigDecimal("29.99");
        BigDecimal shippingPrice = new BigDecimal("0.00");
        BigDecimal buyBoxPrice = new BigDecimal("27.99");
        BigDecimal minThreshold = new BigDecimal("20.00");
        String priceChangeRule = "PERCENTAGE";
        BigDecimal priceChangeValue = new BigDecimal("5.0");
        
        System.out.println("[Step 1] Calculating landed price");
        BigDecimal landedPrice = listingPrice.add(shippingPrice);
        
        if (buyBoxPrice.compareTo(minThreshold) < 0) {
            System.out.println("[Step 2] Buy Box Price is less than threshold, skipping");
            return;
        }
        
        if (buyBoxPrice.compareTo(landedPrice) > 0) {
            System.out.println("[Step 2] Landed Price is already less than Buy Box Price, skipping");
            return;
        }
        
        System.out.println("[Step 3] Calculating new price using " + priceChangeRule + " rule");
        BigDecimal buyBoxPriceExcludingShipping = buyBoxPrice.subtract(shippingPrice);
        BigDecimal newItemPrice;
        
        if ("PERCENTAGE".equals(priceChangeRule)) {
            BigDecimal percentage = priceChangeValue.divide(new BigDecimal("100"));
            newItemPrice = buyBoxPriceExcludingShipping.subtract(buyBoxPriceExcludingShipping.multiply(percentage));
        } else if ("FIXED".equals(priceChangeRule)) {
            newItemPrice = buyBoxPriceExcludingShipping.subtract(priceChangeValue);
        } else {
            System.out.println("Invalid price change rule");
            return;
        }
        
        if (newItemPrice.compareTo(minThreshold) < 0) {
            System.out.println("[Step 4] New price is less than threshold, skipping");
            return;
        }
        
        System.out.println("[Step 4] New listing price: " + newItemPrice);
    }
}
