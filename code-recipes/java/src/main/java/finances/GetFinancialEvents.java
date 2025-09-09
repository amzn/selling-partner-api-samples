package finances;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.finances.v0.DefaultApi;
import software.amazon.spapi.models.finances.v0.*;
import util.Recipe;
import org.threeten.bp.OffsetDateTime;
import org.threeten.bp.format.DateTimeFormatter;
import java.util.List;

import com.amazon.SellingPartnerAPIAA.LWAException;

/**
 * Code Recipe to retrieve financial events from the last 30 days
 * Steps:
 * 1. Initialize Finances API client
 * 2. Calculate date range for last 30 days
 * 3. Retrieve financial events from SP-API
 * 4. Display financial event information
 */
public class GetFinancialEvents extends Recipe {

    private DefaultApi financesApi;
    private OffsetDateTime postedAfter;
    private OffsetDateTime postedBefore;
    private ListFinancialEventsResponse financialEventsResponse;

    @Override
    protected void start() {
        initializeFinancesApi();
        calculateDateRange();
        retrieveFinancialEvents();
        displayResults();
    }

    /**
     * Step 1: Initialize the Finances API client with fresh credentials
     */
    private void initializeFinancesApi() {
        financesApi = new DefaultApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint("https://sellingpartnerapi-na.amazon.com")
            .disableAccessTokenCache()
            .build();
        
        System.out.println("Finances API client initialized");
    }

    /**
     * Step 2: Calculate the date range for the last 30 days
     */
    private void calculateDateRange() {
        postedBefore = OffsetDateTime.now().minusMinutes(2);
        postedAfter = postedBefore.minusDays(180);
        
        System.out.println("Date range calculated: " + postedAfter + " to " + postedBefore);
    }

    /**
     * Step 3: Retrieve financial events from the SP-API
     */
    private void retrieveFinancialEvents() {
        try {
            financialEventsResponse = financesApi.listFinancialEvents(
                100, // maxResultsPerPage
                postedAfter,
                postedBefore,
                null // nextToken
            );
            System.out.println("Financial events retrieved successfully");
        } catch (ApiException e) {
            System.out.println("API Error: " + e.getCode());
            System.out.println("Response: " + e.getResponseBody());
            throw new RuntimeException("Failed to retrieve financial events", e);
        } catch (LWAException e) {
            throw new RuntimeException("Failed to retrieve financial events", e);
        }
    }

    /**
     * Step 4: Display the retrieved financial event information
     */
    private void displayResults() {
        if (financialEventsResponse.getPayload() != null && 
            financialEventsResponse.getPayload().getFinancialEvents() != null) {
            
            FinancialEvents events = financialEventsResponse.getPayload().getFinancialEvents();
            
            if (events.getShipmentEventList() != null && !events.getShipmentEventList().isEmpty()) {
                List<ShipmentEvent> shipmentEvents = events.getShipmentEventList();
                System.out.println("Found " + shipmentEvents.size() + " shipment events:");
                
                for (ShipmentEvent event : shipmentEvents) {
                    System.out.println("Amazon Order ID: " + event.getAmazonOrderId());
                    System.out.println("  Seller Order ID: " + event.getSellerOrderId());
                    System.out.println("  Posted Date: " + event.getPostedDate());
                    System.out.println("  Marketplace: " + event.getMarketplaceName());
                    
                    if (event.getShipmentItemList() != null) {
                        System.out.println("  Items: " + event.getShipmentItemList().size());
                        event.getShipmentItemList().forEach(item -> {
                            System.out.println("    - " + item.getSellerSKU() + 
                                             " (Qty: " + item.getQuantityShipped() + ")");
                        });
                    }
                    System.out.println();
                }
            } else {
                System.out.println("No shipment events found in the last 30 days.");
            }
        } else {
            System.out.println("No financial events found in the last 30 days.");
        }
    }
}