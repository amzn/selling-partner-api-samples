package vendorretailprocurement.transaction;

import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.spapi.api.vendor.transactionstatus.v1.VendorTransactionApi;
import software.amazon.spapi.models.vendor.transactionstatus.v1.Transaction;

/**
 * Integration test for GetTransaction against real SP-API.
 * Requires SP_API_CLIENT_ID, SP_API_CLIENT_SECRET, SP_API_REFRESH_TOKEN env vars.
 * Optionally set SP_API_TRANSACTION_ID to test a specific transaction.
 */
@EnabledIfEnvironmentVariable(named = "SP_API_CLIENT_ID", matches = ".+")
public class GetTransactionIntegrationTest {

    private static final Logger logger = LoggerFactory.getLogger(GetTransactionIntegrationTest.class);
    private static final String SP_API_ENDPOINT = System.getenv("SP_API_ENDPOINT") != null
            ? System.getenv("SP_API_ENDPOINT")
            : "https://sellingpartnerapi-na.amazon.com";

    private static VendorTransactionApi vendorTransactionApi;

    @BeforeAll
    static void setup() {
        logger.info("===========================================");
        logger.info("INTEGRATION TEST - GetTransaction");
        logger.info("Endpoint: {}", SP_API_ENDPOINT);
        logger.info("===========================================");

        LWAAuthorizationCredentials lwaCredentials = LWAAuthorizationCredentials.builder()
                .clientId(System.getenv("SP_API_CLIENT_ID"))
                .clientSecret(System.getenv("SP_API_CLIENT_SECRET"))
                .refreshToken(System.getenv("SP_API_REFRESH_TOKEN"))
                .endpoint("https://api.amazon.com/auth/o2/token")
                .build();

        vendorTransactionApi = new VendorTransactionApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(SP_API_ENDPOINT)
                .build();
    }

    @Test
    void testGetTransaction() throws Exception {
        String transactionId = System.getenv("SP_API_TRANSACTION_ID");
        
        if (transactionId == null || transactionId.isEmpty()) {
            logger.info("--- Skipping getTransaction (no SP_API_TRANSACTION_ID set) ---");
            logger.info("Set SP_API_TRANSACTION_ID env var to test transaction status lookup");
            logger.info("Transaction IDs are returned from POST operations like submitAcknowledgement");
            return;
        }

        logger.info("--- Testing getTransaction (ID: {}) ---", transactionId);

        try {
            var response = vendorTransactionApi.getTransaction(transactionId);

            if (response.getPayload() != null) {
                Transaction transaction = response.getPayload().getTransactionStatus();
                if (transaction != null) {
                    logger.info("Transaction ID: {}", transaction.getTransactionId());
                    logger.info("Status: {}", transaction.getStatus());
                    if (transaction.getErrors() != null && !transaction.getErrors().isEmpty()) {
                        logger.warn("Errors: {}", transaction.getErrors());
                    }
                }
            } else {
                logger.info("No transaction found for ID: {}", transactionId);
            }
        } catch (software.amazon.spapi.ApiException e) {
            logger.error("API Exception - Code: {}, Body: {}", e.getCode(), e.getResponseBody());
            throw e;
        }
    }
}
