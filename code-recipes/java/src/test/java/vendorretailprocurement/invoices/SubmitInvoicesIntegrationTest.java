package vendorretailprocurement.invoices;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.api.vendor.invoices.v1.VendorPaymentsApi;
import software.amazon.spapi.models.vendor.invoices.v1.*;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Integration test for SubmitInvoices against static sandbox.
 * 
 * NOTE: Requires Vendor Payments API permissions. If you get 403 Unauthorized,
 * ensure your SP-API credentials have the "Direct-to-Consumer Shipping" role
 * or appropriate vendor payments permissions.
 * 
 * Sandbox expected request (from vendorInvoices.json):
 * - id: "TestInvoice202"
 * - date: "2020-06-08T12:00:00.000Z"
 * - billToParty.partyId: "TES1"
 * - invoiceType: "Invoice"
 * - remitToParty.partyId: "ABCDE"
 * - invoiceTotal.amount: "112.05"
 * - invoiceTotal.currencyCode: "USD"
 */
@EnabledIfEnvironmentVariable(named = "SP_API_CLIENT_ID", matches = ".+")
public class SubmitInvoicesIntegrationTest {

    private static final Logger logger = LoggerFactory.getLogger(SubmitInvoicesIntegrationTest.class);
    private static final String SANDBOX_ENDPOINT = "https://sandbox.sellingpartnerapi-na.amazon.com";
    private static VendorPaymentsApi vendorPaymentsApi;

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

        vendorPaymentsApi = new VendorPaymentsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(SANDBOX_ENDPOINT)
                .build();

        logger.info("===========================================");
        logger.info("SANDBOX TEST - SubmitInvoices");
        logger.info("Endpoint: {}", SANDBOX_ENDPOINT);
        logger.info("===========================================");
    }

    @Test
    void testSubmitInvoices() throws Exception {
        logger.info("--- Testing submitInvoices (sandbox) ---");

        // Build request matching sandbox expected data exactly
        Invoice invoice = new Invoice()
                .id("TestInvoice202")
                .invoiceType(Invoice.InvoiceTypeEnum.INVOICE)
                .date(OffsetDateTime.parse("2020-06-08T12:00:00.000Z"))
                .remitToParty(new PartyIdentification().partyId("ABCDE"))
                .billToParty(new PartyIdentification().partyId("TES1"))
                .invoiceTotal(new Money()
                        .amount("112.05")
                        .currencyCode("USD"));

        SubmitInvoicesRequest request = new SubmitInvoicesRequest()
                .invoices(Collections.singletonList(invoice));

        try {
            SubmitInvoicesResponse response = vendorPaymentsApi.submitInvoices(request);

            assertNotNull(response);
            if (response.getPayload() != null && response.getPayload().getTransactionId() != null) {
                logger.info("Transaction ID: {}", response.getPayload().getTransactionId());
            } else {
                logger.info("Invoice submitted (no transaction ID in response)");
            }
        } catch (software.amazon.spapi.ApiException e) {
            logger.error("API Exception - Code: {}, Body: {}", e.getCode(), e.getResponseBody());
            fail("API call failed: " + e.getCode() + " - " + e.getResponseBody());
        }
    }
}
