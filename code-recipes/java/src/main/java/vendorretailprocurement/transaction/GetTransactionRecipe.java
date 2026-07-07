package vendorretailprocurement.transaction;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.transactionstatus.v1.VendorTransactionApi;
import software.amazon.spapi.models.vendor.transactionstatus.v1.GetTransactionResponse;
import software.amazon.spapi.models.vendor.transactionstatus.v1.Transaction;
import util.Constants;
import util.Recipe;

/**
 * Vendor Transaction Status API Recipe: Get Transaction
 * ======================================================
 * 
 * This recipe demonstrates how to check the status of asynchronous
 * POST transactions using the Vendor Transaction Status API.
 * 
 * Use cases:
 * - Check if a submitAcknowledgement was processed successfully
 * - Check if a submitShipmentConfirmations was processed
 * - Check if a submitInvoices was processed
 * - Monitor async operation completion
 * 
 * Transaction statuses:
 * - Processing: Transaction is still being processed
 * - Success: Transaction completed successfully
 * - Failure: Transaction failed (check errors for details)
 * 
 * API Operations used:
 * - getTransaction: Returns the status of a specific transaction
 */
public class GetTransactionRecipe extends Recipe {
    private static final Logger logger = LoggerFactory.getLogger(GetTransactionRecipe.class);

    private final VendorTransactionApi vendorTransactionApi = new VendorTransactionApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        // Example: Check status of a transaction
        String transactionId = "20190904190535-eef8cad8-418e-4ed3-ac72-789e2ee6214a";
        
        Transaction transaction = getTransactionStatus(transactionId);
        if (transaction != null) {
            logTransactionStatus(transaction);
        }
    }

    /**
     * Get the status of a transaction by its ID.
     * 
     * @param transactionId The GUID returned from a POST operation
     * @return Transaction status object, or null if not found
     */
    public Transaction getTransactionStatus(String transactionId) {
        try {
            GetTransactionResponse response = vendorTransactionApi.getTransaction(transactionId);
            
            if (response.getPayload() != null && response.getPayload().getTransactionStatus() != null) {
                logger.info("Retrieved status for transaction: {}", transactionId);
                return response.getPayload().getTransactionStatus();
            }
            logger.warn("No status found for transaction: {}", transactionId);
            return null;
        } catch (ApiException | LWAException e) {
            logger.error("Error getting transaction status for {}: {}", transactionId, e.getMessage(), e);
            throw new RuntimeException("Failed to get transaction status", e);
        }
    }

    /**
     * Check if a transaction has completed (success or failure).
     */
    public boolean isTransactionComplete(String transactionId) {
        Transaction transaction = getTransactionStatus(transactionId);
        if (transaction == null) {
            return false;
        }
        
        String status = transaction.getStatus().getValue();
        return "Success".equals(status) || "Failure".equals(status);
    }

    /**
     * Check if a transaction was successful.
     */
    public boolean isTransactionSuccessful(String transactionId) {
        Transaction transaction = getTransactionStatus(transactionId);
        if (transaction == null) {
            return false;
        }
        
        return "Success".equals(transaction.getStatus().getValue());
    }

    /**
     * Poll for transaction completion with timeout.
     * 
     * @param transactionId The transaction to poll
     * @param maxAttempts Maximum number of polling attempts
     * @param delayMs Delay between attempts in milliseconds
     * @return Final transaction status, or null if timeout
     */
    public Transaction pollForCompletion(String transactionId, int maxAttempts, long delayMs) {
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            Transaction transaction = getTransactionStatus(transactionId);
            
            if (transaction != null) {
                String status = transaction.getStatus().getValue();
                logger.info("Attempt {}/{}: Transaction {} status = {}", 
                        attempt, maxAttempts, transactionId, status);
                
                if ("Success".equals(status) || "Failure".equals(status)) {
                    return transaction;
                }
            }
            
            if (attempt < maxAttempts) {
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        
        logger.warn("Transaction {} did not complete within {} attempts", transactionId, maxAttempts);
        return null;
    }

    private void logTransactionStatus(Transaction transaction) {
        logger.info("========================================");
        logger.info("Transaction Status");
        logger.info("========================================");
        logger.info("Transaction ID: {}", transaction.getTransactionId());
        logger.info("Status: {}", transaction.getStatus());
        
        if (transaction.getErrors() != null && !transaction.getErrors().isEmpty()) {
            logger.info("Errors:");
            for (var error : transaction.getErrors()) {
                logger.info("  - Code: {} | Message: {}", error.getCode(), error.getMessage());
            }
        }
    }
}
