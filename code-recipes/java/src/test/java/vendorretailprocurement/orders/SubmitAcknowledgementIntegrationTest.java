package vendorretailprocurement.orders;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.amazon.SellingPartnerAPIAA.LWAException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.orders.v1.VendorOrdersApi;
import software.amazon.spapi.models.vendor.orders.v1.*;

import java.util.List;

/**
 * Integration test for submitAcknowledgement - uses SANDBOX endpoint.
 */
@EnabledIfEnvironmentVariable(named = "SP_API_CLIENT_ID", matches = ".+")
public class SubmitAcknowledgementIntegrationTest {

    private static final Logger logger = LoggerFactory.getLogger(SubmitAcknowledgementIntegrationTest.class);
    private static final String SANDBOX_ENDPOINT = "https://sandbox.sellingpartnerapi-na.amazon.com";
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
                .endpoint(SANDBOX_ENDPOINT)
                .build();

        logger.info("===========================================");
        logger.info("SANDBOX TEST - submitAcknowledgement");
        logger.info("Endpoint: {}", SANDBOX_ENDPOINT);
        logger.info("===========================================");
    }

    @Test
    void testSubmitAcknowledgement() throws ApiException, LWAException {
        logger.info("--- Testing submitAcknowledgement (sandbox) ---");

        OrderItemAcknowledgement itemAck = new OrderItemAcknowledgement()
                .acknowledgementCode(OrderItemAcknowledgement.AcknowledgementCodeEnum.ACCEPTED)
                .acknowledgedQuantity(new ItemQuantity().amount(10));

        OrderAcknowledgementItem item = new OrderAcknowledgementItem()
                .vendorProductIdentifier("028877454078")
                .orderedQuantity(new ItemQuantity().amount(10))
                .netCost(new Money().amount("10.2"))
                .itemAcknowledgements(List.of(itemAck));

        OrderAcknowledgement orderAck = new OrderAcknowledgement()
                .purchaseOrderNumber("TestOrder202")
                .sellingParty(new PartyIdentification().partyId("API01"))
                .acknowledgementDate(OffsetDateTime.now())
                .items(List.of(item));

        SubmitAcknowledgementRequest request = new SubmitAcknowledgementRequest()
                .acknowledgements(List.of(orderAck));

        SubmitAcknowledgementResponse response = vendorOrdersApi.submitAcknowledgement(request);

        if (response.getPayload() != null) {
            logger.info("Transaction ID: {}", response.getPayload().getTransactionId());
        }
    }
}
