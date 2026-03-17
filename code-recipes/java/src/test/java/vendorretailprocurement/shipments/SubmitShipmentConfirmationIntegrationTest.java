package vendorretailprocurement.shipments;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.api.vendor.shipments.v1.VendorShippingApi;
import software.amazon.spapi.models.vendor.shipments.v1.*;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Integration test for SubmitShipmentConfirmation against static sandbox.
 * 
 * Run with:
 * export SP_API_CLIENT_ID="your-client-id"
 * export SP_API_CLIENT_SECRET="your-client-secret"
 * export SP_API_REFRESH_TOKEN="your-refresh-token"
 * ./gradlew test --tests "vendorretailprocurement.shipments.SubmitShipmentConfirmationIntegrationTest"
 */
@EnabledIfEnvironmentVariable(named = "SP_API_CLIENT_ID", matches = ".+")
public class SubmitShipmentConfirmationIntegrationTest {

    private static final Logger logger = LoggerFactory.getLogger(SubmitShipmentConfirmationIntegrationTest.class);
    
    // Use sandbox endpoint for POST operations
    private static final String SANDBOX_ENDPOINT = "https://sandbox.sellingpartnerapi-na.amazon.com";
    
    private static VendorShippingApi vendorShippingApi;

    @BeforeAll
    static void setup() {
        String clientId = System.getenv("SP_API_CLIENT_ID");
        String clientSecret = System.getenv("SP_API_CLIENT_SECRET");
        String refreshToken = System.getenv("SP_API_REFRESH_TOKEN");

        LWAAuthorizationCredentials lwaCredentials = LWAAuthorizationCredentials.builder()
                .clientId(clientId)
                .clientSecret(clientSecret)
                .refreshToken(refreshToken)
                .endpoint("https://api.amazon.com/auth/o2/token")
                .build();

        vendorShippingApi = new VendorShippingApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(SANDBOX_ENDPOINT)
                .build();

        logger.info("===========================================");
        logger.info("SANDBOX TEST - SubmitShipmentConfirmation");
        logger.info("Endpoint: {}", SANDBOX_ENDPOINT);
        logger.info("===========================================");
    }

    @Test
    void testSubmitShipmentConfirmation() throws Exception {
        logger.info("--- Testing submitShipmentConfirmations (sandbox) ---");

        // Build request matching sandbox expected data
        ShipmentConfirmation confirmation = new ShipmentConfirmation()
                .shipmentIdentifier("TestShipmentConfirmation202")
                .shipmentConfirmationDate(OffsetDateTime.now())
                .sellingParty(new PartyIdentification().partyId("ABCD1"))
                .shipFromParty(new PartyIdentification().partyId("EFGH1"))
                .shipToParty(new PartyIdentification().partyId("JKL1"))
                .shipmentConfirmationType(ShipmentConfirmation.ShipmentConfirmationTypeEnum.ORIGINAL)
                .shippedItems(Collections.singletonList(
                        new Item()
                                .itemSequenceNumber("001")
                                .shippedQuantity(new ItemQuantity()
                                        .amount(100)
                                        .unitOfMeasure(ItemQuantity.UnitOfMeasureEnum.EACHES))
                                .itemDetails(new ItemDetails()
                                        .purchaseOrderNumber("TestOrder202"))
                ));

        SubmitShipmentConfirmationsRequest request = new SubmitShipmentConfirmationsRequest()
                .shipmentConfirmations(Collections.singletonList(confirmation));

        try {
            SubmitShipmentConfirmationsResponse response = vendorShippingApi.submitShipmentConfirmations(request);

            assertNotNull(response);
            if (response.getPayload() != null && response.getPayload().getTransactionId() != null) {
                logger.info("Transaction ID: {}", response.getPayload().getTransactionId());
            } else {
                logger.info("Shipment confirmation submitted (no transaction ID in response)");
            }
        } catch (software.amazon.spapi.ApiException e) {
            logger.error("API Exception - Code: {}, Body: {}", e.getCode(), e.getResponseBody());
            fail("API call failed: " + e.getCode() + " - " + e.getResponseBody());
        }
    }
}
