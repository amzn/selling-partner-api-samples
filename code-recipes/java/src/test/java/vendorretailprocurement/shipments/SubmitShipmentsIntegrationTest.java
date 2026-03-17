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
 * Integration test for SubmitShipments against static sandbox.
 */
@EnabledIfEnvironmentVariable(named = "SP_API_CLIENT_ID", matches = ".+")
public class SubmitShipmentsIntegrationTest {

    private static final Logger logger = LoggerFactory.getLogger(SubmitShipmentsIntegrationTest.class);
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
        logger.info("SANDBOX TEST - SubmitShipments");
        logger.info("Endpoint: {}", SANDBOX_ENDPOINT);
        logger.info("===========================================");
    }

    @Test
    void testSubmitShipments() throws Exception {
        logger.info("--- Testing submitShipments (sandbox) ---");

        // Build request matching sandbox expected data
        PurchaseOrderItems poItem = new PurchaseOrderItems()
                .itemSequenceNumber("001")
                .vendorProductIdentifier("9782700001659")
                .shippedQuantity(new ItemQuantity()
                        .amount(100)
                        .unitOfMeasure(ItemQuantity.UnitOfMeasureEnum.EACHES));

        PurchaseOrders purchaseOrder = new PurchaseOrders()
                .purchaseOrderNumber("1BBBAAAA")
                .items(Collections.singletonList(poItem));

        TransportShipmentMeasurements measurements = new TransportShipmentMeasurements()
                .totalCartonCount(30)
                .totalPalletStackable(30)
                .totalPalletNonStackable(30);

        Shipment shipment = new Shipment()
                .vendorShipmentIdentifier("00050003")
                .buyerReferenceNumber("1234567")
                .transactionType(Shipment.TransactionTypeEnum.NEW)
                .transactionDate(OffsetDateTime.now())
                .shipmentFreightTerm(Shipment.ShipmentFreightTermEnum.COLLECT)
                .sellingParty(new PartyIdentification().partyId("PQRSS"))
                .shipFromParty(new PartyIdentification()
                        .partyId("999US")
                        .address(new Address()
                                .name("ABC electronics warehouse")
                                .addressLine1("DEF 1st street")
                                .city("Lisses")
                                .stateOrRegion("abcland")
                                .postalCode("91090")
                                .countryCode("DE")))
                .shipToParty(new PartyIdentification().partyId("ABCDF"))
                .shipmentMeasurements(measurements)
                .purchaseOrders(Collections.singletonList(purchaseOrder));

        SubmitShipments request = new SubmitShipments()
                .shipments(Collections.singletonList(shipment));

        try {
            SubmitShipmentConfirmationsResponse response = vendorShippingApi.submitShipments(request);

            assertNotNull(response);
            if (response.getPayload() != null && response.getPayload().getTransactionId() != null) {
                logger.info("Transaction ID: {}", response.getPayload().getTransactionId());
            } else {
                logger.info("Shipment submitted (no transaction ID in response)");
            }
        } catch (software.amazon.spapi.ApiException e) {
            logger.error("API Exception - Code: {}, Body: {}", e.getCode(), e.getResponseBody());
            fail("API call failed: " + e.getCode() + " - " + e.getResponseBody());
        }
    }
}
