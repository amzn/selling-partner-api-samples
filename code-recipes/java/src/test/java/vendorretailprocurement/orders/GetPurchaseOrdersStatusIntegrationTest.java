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
import software.amazon.spapi.models.vendor.orders.v1.GetPurchaseOrdersStatusResponse;
import org.threeten.bp.OffsetDateTime;

@EnabledIfEnvironmentVariable(named = "SP_API_CLIENT_ID", matches = ".+")
public class GetPurchaseOrdersStatusIntegrationTest {

    private static final Logger logger = LoggerFactory.getLogger(GetPurchaseOrdersStatusIntegrationTest.class);
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
        logger.info("INTEGRATION TEST - getPurchaseOrdersStatus");
        logger.info("Endpoint: {}", SP_API_ENDPOINT);
        logger.info("===========================================");
    }

    @Test
    void testGetPurchaseOrdersStatus() throws ApiException, LWAException {
        logger.info("--- Testing getPurchaseOrdersStatus ---");
        GetPurchaseOrdersStatusResponse response = vendorOrdersApi.getPurchaseOrdersStatus(
                10L, "DESC", null, null, null,
                OffsetDateTime.now().minusDays(7), OffsetDateTime.now(),
                null, null, null, null, null, null
        );
        if (response.getPayload() != null && response.getPayload().getOrdersStatus() != null) {
            logger.info("Found {} order statuses", response.getPayload().getOrdersStatus().size());
            for (var status : response.getPayload().getOrdersStatus()) {
                logger.info("  PO: {} | Status: {}", status.getPurchaseOrderNumber(), status.getPurchaseOrderStatus());
            }
        }
    }
}
