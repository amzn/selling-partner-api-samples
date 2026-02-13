package util.notifications.pricing;

import com.google.gson.annotations.SerializedName;
import java.util.List;

/**
 * An explanation about the purpose of this instance.
 */
public class Summary {
    @SerializedName("BuyBoxPrices")
    private List<BuyBoxPriceElement> buyBoxPrices;
    
    @SerializedName("CompetitivePriceThreshold")
    private CompetitivePriceThreshold competitivePriceThreshold;
    
    @SerializedName("ListPrice")
    private ListPrice listPrice;
    
    @SerializedName("LowestPrices")
    private List<LowestPriceElement> lowestPrices;
    
    @SerializedName("MinimumAdvertisedPrice")
    private MinimumAdvertisedPrice minimumAdvertisedPrice;
    
    @SerializedName("NumberOfBuyBoxEligibleOffers")
    private List<NumberOfBuyBoxEligibleOfferElement> numberOfBuyBoxEligibleOffers;
    
    @SerializedName("NumberOfOffers")
    private List<NumberOfOfferElement> numberOfOffers;
    
    @SerializedName("SalesRankings")
    private List<SalesRankingElement> salesRankings;
    
    @SerializedName("SuggestedLowerPricePlusShipping")
    private SuggestedLowerPricePlusShipping suggestedLowerPricePlusShipping;
    
    @SerializedName("TotalBuyBoxEligibleOffers")
    private long totalBuyBoxEligibleOffers;

    public List<BuyBoxPriceElement> getBuyBoxPrices() {
        return buyBoxPrices;
    }

    public CompetitivePriceThreshold getCompetitivePriceThreshold() {
        return competitivePriceThreshold;
    }

    public ListPrice getListPrice() {
        return listPrice;
    }

    public List<LowestPriceElement> getLowestPrices() {
        return lowestPrices;
    }

    public MinimumAdvertisedPrice getMinimumAdvertisedPrice() {
        return minimumAdvertisedPrice;
    }

    public List<NumberOfBuyBoxEligibleOfferElement> getNumberOfBuyBoxEligibleOffers() {
        return numberOfBuyBoxEligibleOffers;
    }

    public List<NumberOfOfferElement> getNumberOfOffers() {
        return numberOfOffers;
    }

    public List<SalesRankingElement> getSalesRankings() {
        return salesRankings;
    }

    public SuggestedLowerPricePlusShipping getSuggestedLowerPricePlusShipping() {
        return suggestedLowerPricePlusShipping;
    }

    public long getTotalBuyBoxEligibleOffers() {
        return totalBuyBoxEligibleOffers;
    }
}
