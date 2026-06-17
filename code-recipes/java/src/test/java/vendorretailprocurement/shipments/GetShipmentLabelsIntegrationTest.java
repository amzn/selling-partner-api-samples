package vendorretailprocurement.shipments;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.api.vendor.shipments.v1.VendorShippingApi;
import software.amazon.spapi.models.vendor.shipments.v1.TransportationLabels;
import software.amazon.spapi.models.vendor.shipments.v1.TransportLabel;

/**
 * Integration test for GetShipmentLabels against real SP-API.
 * Requires SP_API_CLIENT_ID, SP_API_CLIENT_SECRET, SP_API_REFRESH_TOKEN env vars.
 */
@EnabledIfEnvironmentVariable(named = "SP_API_CLIENT_ID", matches = ".+")
public class GetShipmentLabelsIntegrationTest {

    private static final Logger logger = LoggerFactory.getLogger(GetShipmentLabelsIntegrationTest.class);
    private static final String SP_API_ENDPOINT = System.getenv("SP_API_ENDPOINT") != null
            ? System.getenv("SP_API_ENDPOINT")
            : "https://sellingpartnerapi-na.amazon.com";

    private static VendorShippingApi vendorShippingApi;

    @BeforeAll
    static void setup() {
        logger.info("===========================================");
        logger.info("INTEGRATION TEST - GetShipmentLabels");
        logger.info("Endpoint: {}", SP_API_ENDPOINT);
        logger.info("===========================================");

        LWAAuthorizationCredentials lwaCredentials = LWAAuthorizationCredentials.builder()
                .clientId(System.getenv("SP_API_CLIENT_ID"))
                .clientSecret(System.getenv("SP_API_CLIENT_SECRET"))
                .refreshToken(System.getenv("SP_API_REFRESH_TOKEN"))
                .endpoint("https://api.amazon.com/auth/o2/token")
                .build();

        vendorShippingApi = new VendorShippingApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(SP_API_ENDPOINT)
                .build();
    }

    @Test
    void testGetShipmentLabels() throws Exception {
        logger.info("--- Testing getShipmentLabels (last 30 days) ---");

        OffsetDateTime labelCreatedAfter = OffsetDateTime.now().minusDays(30);
        OffsetDateTime labelCreatedBefore = OffsetDateTime.now();

        try {
            var response = vendorShippingApi.getShipmentLabels(
                    10L,                    // limit
                    "DESC",                 // sortOrder
                    null,                   // nextToken
                    labelCreatedAfter,      // labelCreatedAfter
                    labelCreatedBefore,     // labelCreatedBefore
                    null,                   // buyerReferenceNumber
                    null,                   // vendorShipmentIdentifier
                    null                    // sellerWarehouseCode
            );

            if (response.getPayload() != null) {
                TransportationLabels labels = response.getPayload();
                if (labels.getTransportLabels() != null && !labels.getTransportLabels().isEmpty()) {
                    logger.info("Found {} transport labels", labels.getTransportLabels().size());
                    for (TransportLabel label : labels.getTransportLabels()) {
                        logger.info("  Label Created: {}", label.getLabelCreateDateTime());
                        if (label.getShipmentInformation() != null) {
                            logger.info("    Shipment Info: {}", label.getShipmentInformation());
                        }
                    }
                } else {
                    logger.info("No transport labels found in the last 30 days");
                }
            } else {
                logger.info("No payload returned - no labels available");
            }
        } catch (software.amazon.spapi.ApiException e) {
            logger.error("API Exception - Code: {}, Body: {}", e.getCode(), e.getResponseBody());
            throw e;
        }
    }
}
