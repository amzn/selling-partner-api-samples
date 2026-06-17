package vendorretailprocurement.shipments;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.amazon.SellingPartnerAPIAA.LWAException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.shipments.v1.VendorShippingApi;
import software.amazon.spapi.models.vendor.shipments.v1.GetShipmentDetailsResponse;
import software.amazon.spapi.models.vendor.shipments.v1.Shipment;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Integration test for GetShipmentDetailsRecipe against real SP-API.
 * 
 * Requires environment variables:
 * - SP_API_CLIENT_ID
 * - SP_API_CLIENT_SECRET
 * - SP_API_REFRESH_TOKEN
 * 
 * Optional:
 * - SP_API_ENDPOINT (defaults to production NA)
 */
public class GetShipmentDetailsIntegrationTest {
    private static final Logger logger = LoggerFactory.getLogger(GetShipmentDetailsIntegrationTest.class);

    private static final String SP_API_ENDPOINT = System.getenv("SP_API_ENDPOINT") != null
            ? System.getenv("SP_API_ENDPOINT")
            : "https://sellingpartnerapi-na.amazon.com";

    private static VendorShippingApi vendorShippingApi;

    @BeforeAll
    static void setup() {
        String clientId = System.getenv("SP_API_CLIENT_ID");
        String clientSecret = System.getenv("SP_API_CLIENT_SECRET");
        String refreshToken = System.getenv("SP_API_REFRESH_TOKEN");

        assumeTrue(clientId != null && !clientId.isEmpty(),
                "Skipping integration test - SP_API_CLIENT_ID not set");

        logger.info("===========================================");
        logger.info("INTEGRATION TEST - GetShipmentDetails");
        logger.info("Endpoint: {}", SP_API_ENDPOINT);
        logger.info("===========================================");

        LWAAuthorizationCredentials lwaCredentials = LWAAuthorizationCredentials.builder()
                .clientId(clientId)
                .clientSecret(clientSecret)
                .refreshToken(refreshToken)
                .endpoint("https://api.amazon.com/auth/o2/token")
                .build();

        vendorShippingApi = new VendorShippingApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(SP_API_ENDPOINT)
                .build();
    }

    @Test
    void testGetShipmentDetails() throws ApiException, LWAException {
        logger.info("--- Testing getShipmentDetails (last 30 days) ---");

        OffsetDateTime createdAfter = OffsetDateTime.now().minusDays(30);
        OffsetDateTime createdBefore = OffsetDateTime.now();

        GetShipmentDetailsResponse response = vendorShippingApi.getShipmentDetails(
                10L,              // limit
                "DESC",           // sortOrder
                null,             // nextToken
                createdAfter,     // createdAfter
                createdBefore,    // createdBefore
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null
        );

        if (response.getPayload() != null && response.getPayload().getShipments() != null) {
            logger.info("Found {} shipments", response.getPayload().getShipments().size());
            for (Shipment shipment : response.getPayload().getShipments()) {
                logger.info("  Shipment: {} | Buyer Ref: {} | Status: {}",
                        shipment.getVendorShipmentIdentifier(),
                        shipment.getBuyerReferenceNumber(),
                        shipment.getCurrentShipmentStatus());
            }
        } else {
            logger.info("No shipments found in the last 30 days");
        }
    }
}
