package messaging;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.messaging.v1.MessagingApi;
import software.amazon.spapi.models.messaging.v1.*;
import software.amazon.spapi.models.uploads.v2020_11_01.*;
import software.amazon.spapi.api.uploads.v2020_11_01.UploadsApi;
import util.Recipe;
import util.Constants;
import java.util.Arrays;
import java.util.List;

import com.amazon.SellingPartnerAPIAA.LWAException;
import java.security.NoSuchAlgorithmException;
import java.io.InputStream;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.io.IOException;

/**
 * Code Recipe to send a message to a buyer using the Messaging API
 * Steps:
 * 1. Setup Order Details.
 * 1. Initialize Messaging API client
 * 2. Get available message types for an order
 * 3. Calculate B64 encoded MD5 Hash for Invoice file
 * 4. Create Upload Destination
 * 5. Upload Invoice to URL
 * 6. Send Invoice Message to Buyer
 */

public class SendInvoiceToBuyerRecipe extends Recipe {

    private MessagingApi messagingApi;
    private UploadsApi uploadsApi;
    private String amazonOrderId;
    private List<String> marketplaceIds;
    private String invoiceFilePath;
    private String contentType;

    @Override
    protected void start() {
        setupOrderDetails();
        initializeMessagingApi();
        GetMessagingActionsForOrderResponse actions = getAvailableMessageTypes();
        Boolean canSendInvoice = checkCanSendInvoice(actions);
        if (canSendInvoice) {
            System.out.println("✅ You can send an invoice for this order");
            initializeUploadsApi();
            String md5 = calculateMd5();
            CreateUploadDestinationResponse response = createUploadDestination(md5);
            Boolean uploaded = UploadInvoice(response.getPayload().getUrl(), invoiceFilePath, md5);
            if (uploaded) {
                System.out.println("✅ Invoice uploaded");
                SendInvoiceMessage(response.getPayload().getUploadDestinationId(),amazonOrderId,"Invoice.pdf");

            } else {
                System.out.println("❌ Failed to upload invoice");
            }
        } else {
            System.out.println("❌ You cannot send an invoice for this order");
            return;
        }
    }

    private Boolean checkCanSendInvoice(GetMessagingActionsForOrderResponse actions) {
        for (LinkObject link : actions.getLinks().getActions()) {
            if (link.getName().contains("sendInvoice")) {
                return true;
            }
        }
        return false;
    }

    private void initializeMessagingApi() {
        messagingApi = new MessagingApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Messaging API client initialized");
    }

    private void setupOrderDetails() {
        amazonOrderId = "701-2312323-4427400";
        marketplaceIds = Arrays.asList("A2Q3Y263D00KWC");
        invoiceFilePath = "src/main/resources/invoice.pdf";
        contentType = "application/pdf";
        System.out.println("Order details configured: " + amazonOrderId);
    }

    private GetMessagingActionsForOrderResponse getAvailableMessageTypes() {
        try {
            return messagingApi.getMessagingActionsForOrder(amazonOrderId, marketplaceIds);
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get messaging actions", e);
        }
    }

    private void initializeUploadsApi() {
        uploadsApi = new UploadsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("Uploads API client initialized");
    }

    private String calculateMd5() {
        try (InputStream is = new FileInputStream(invoiceFilePath)) {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] buffer = new byte[4096];
            int read;
            while ((read = is.read(buffer)) > 0) {
                md.update(buffer, 0, read);
            }
            return java.util.Base64.getEncoder().encodeToString(md.digest());
        } catch (NoSuchAlgorithmException | IOException e) {
            throw new RuntimeException("Error calculating MD5", e);
        }
    }

    private CreateUploadDestinationResponse createUploadDestination(String md5) {
        try {
            String resource = "messaging/v1/orders/" + amazonOrderId + "/messages/invoice";
            return uploadsApi.createUploadDestinationForResource(marketplaceIds, md5, resource, contentType);
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to create upload destination", e);
        }
    }

    private Boolean UploadInvoice(String uploadDestinationUrl, String invoiceFilePath, String contentMd5) {
        try (InputStream is = new FileInputStream(invoiceFilePath)) {
            byte[] fileBytes = is.readAllBytes();
            okhttp3.RequestBody requestBody = okhttp3.RequestBody.create(fileBytes,
                    okhttp3.MediaType.get(contentType));
            okhttp3.Request request = new okhttp3.Request.Builder()
                    .url(uploadDestinationUrl)
                    .put(requestBody)
                    .header("Content-MD5", contentMd5)
                    .build();

            okhttp3.OkHttpClient client = new okhttp3.OkHttpClient();
            try (okhttp3.Response response = client.newCall(request).execute()) {
                return response.isSuccessful();
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to upload invoice", e);
        }
    }

    private void SendInvoiceMessage(String uploadDestinationId, String orderId, String fileName) {
        InvoiceRequest body = new InvoiceRequest();
        Attachment attachment = new Attachment();
        attachment.setFileName(fileName);
        attachment.setUploadDestinationId(uploadDestinationId);
        body.setAttachments(Arrays.asList(attachment));
        
        try {
            InvoiceResponse response = messagingApi.sendInvoice(body, orderId, marketplaceIds);
            System.out.println("✅ Invoice message sent successfully");
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to send invoice message", e);
        }
    }
}
