package vendorretailprocurement.invoices;

import com.amazon.SellingPartnerAPIAA.LWAException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.vendor.invoices.v1.VendorPaymentsApi;
import software.amazon.spapi.models.vendor.invoices.v1.*;
import util.Constants;
import util.Recipe;

import java.util.Collections;

/**
 * Vendor Invoices API Recipe: Submit Invoices
 * ============================================
 * 
 * This recipe demonstrates how to submit invoices or credit notes to Amazon.
 * 
 * Use cases:
 * - Submit invoices for shipped goods
 * - Submit credit notes for returns or adjustments
 * 
 * API Operations used:
 * - submitInvoices: Submit one or more invoices (async - returns transactionId)
 */
public class SubmitInvoicesRecipe extends Recipe {

    private static final Logger logger = LoggerFactory.getLogger(SubmitInvoicesRecipe.class);

    private final VendorPaymentsApi vendorPaymentsApi = new VendorPaymentsApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    public void start() {
        logger.info("=== Submitting Invoice ===");
        
        Invoice invoice = buildSampleInvoice();
        String transactionId = submitInvoice(invoice);
        
        if (transactionId != null) {
            logger.info("Invoice submitted successfully");
            logger.info("Transaction ID: {}", transactionId);
            logger.info("Use GetTransaction API to check processing status");
        }
    }

    /**
     * Build a sample invoice matching sandbox expected data.
     */
    private Invoice buildSampleInvoice() {
        return new Invoice()
                .id("TestInvoice202")
                .invoiceType(Invoice.InvoiceTypeEnum.INVOICE)
                .date(OffsetDateTime.parse("2020-06-08T12:00:00.000Z"))
                .remitToParty(new PartyIdentification().partyId("ABCDE"))
                .billToParty(new PartyIdentification().partyId("TES1"))
                .invoiceTotal(new Money()
                        .amount("112.05")
                        .currencyCode("USD"));
    }

    /**
     * Submit an invoice.
     * 
     * @param invoice The invoice to submit
     * @return Transaction ID for tracking, or null if failed
     */
    public String submitInvoice(Invoice invoice) {
        try {
            logger.info("Submitting invoice: {}", invoice.getId());
            
            SubmitInvoicesRequest request = new SubmitInvoicesRequest()
                    .invoices(Collections.singletonList(invoice));

            SubmitInvoicesResponse response = vendorPaymentsApi.submitInvoices(request);

            if (response.getPayload() != null && response.getPayload().getTransactionId() != null) {
                return response.getPayload().getTransactionId();
            }
            
            logger.info("Invoice submitted (no transaction ID returned)");
            return null;

        } catch (ApiException e) {
            logger.error("API Error submitting invoice: {}", e.getMessage());
            throw new RuntimeException("Failed to submit invoice", e);
        } catch (LWAException e) {
            logger.error("Authentication error: {}", e.getMessage());
            throw new RuntimeException("Authentication error", e);
        }
    }
}
