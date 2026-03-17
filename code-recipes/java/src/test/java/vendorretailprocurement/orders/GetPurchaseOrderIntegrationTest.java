package vendorretailprocurement.orders;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.amazon.SellingPartnerAPIAA.LWAException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.orders.v1.VendorOrdersApi;
import software.amazon.spapi.models.vendor.orders.v1.*;
import org.threeten.bp.OffsetDateTime;

/**
 * Integration test for Vendor Orders API - makes REAL SP-API calls.
 * 
 * Required environment variables:
 * - SP_API_CLIENT_ID, SP_API_CLIENT_SECRET, SP_API_REFRESH_TOKEN
 */
@EnabledIfEnvironmentVariable(named = "SP_API_CLIENT_ID", matches = ".+")
public class GetPurchaseOrderIntegrationTest {

    private static final Logger logger = LoggerFactory.getLogger(GetPurchaseOrderIntegrationTest.class);
    private static final String SP_API_ENDPOINT = System.getenv("SP_API_ENDPOINT") != null
            ? System.getenv("SP_API_ENDPOINT") : "https://sellingpartnerapi-na.amazon.com";
    private static VendorOrdersApi vendorOrdersApi;

    @BeforeAll
    static void setup() {
        LWAAuthorizationCredentials lwaCredentials = LWAAuthorizationCredentials.builder()
                .clientId(System.getenv("SP_API_CLIENT_ID"))
                .clientSecret(System.getenv("SP_API_CLIENT_SECRET"))
                .refreshToken(System.getenv("SP_API_REFRESH_TOKEN"))
                .endpoint("https://api.amazon.com/auth/o2/token")
                .build();

        vendorOrdersApi = new VendorOrdersApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(SP_API_ENDPOINT)
                .build();

        logger.info("===========================================");
        logger.info("INTEGRATION TEST - Real SP-API Calls");
        logger.info("Endpoint: {}", SP_API_ENDPOINT);
        logger.info("===========================================");
    }

    @Test
    void testGetPurchaseOrders() throws ApiException, LWAException {
        logger.info("--- Testing getPurchaseOrders (date range) ---");
        GetPurchaseOrdersResponse response = vendorOrdersApi.getPurchaseOrders(
                10L, OffsetDateTime.now().minusDays(7), OffsetDateTime.now(),
                null, null, null, null, null, null, null, null, null
        );
        if (response.getPayload() != null && response.getPayload().getOrders() != null) {
            logger.info("Found {} orders", response.getPayload().getOrders().size());
            for (var order : response.getPayload().getOrders()) {
                logger.info("  PO: {} | State: {}", order.getPurchaseOrderNumber(), order.getPurchaseOrderState());
            }
        }
    }

    @Test
    void testGetPurchaseOrder() throws ApiException, LWAException {
        String poNumber = System.getenv("SP_API_PURCHASE_ORDER");
        if (poNumber == null) {
            logger.info("--- Skipping getPurchaseOrder (no SP_API_PURCHASE_ORDER set) ---");
            return;
        }
        logger.info("--- Testing getPurchaseOrder (single PO: {}) ---", poNumber);
        GetPurchaseOrderResponse response = vendorOrdersApi.getPurchaseOrder(poNumber);
        if (response.getPayload() != null) {
            var order = response.getPayload();
            logger.info("PO Number: {}", order.getPurchaseOrderNumber());
            logger.info("State: {}", order.getPurchaseOrderState());
        }
    }
}
