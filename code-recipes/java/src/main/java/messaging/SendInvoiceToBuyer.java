package messaging;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.messaging.v1.MessagingApi;
import software.amazon.spapi.models.messaging.v1.GetMessagingActionsForOrderResponse;
import software.amazon.spapi.models.messaging.v1.LinkObject;
import software.amazon.spapi.models.uploads.v2020_11_01.*;
import software.amazon.spapi.api.uploads.v2020_11_01.UploadsApi;
import util.Recipe;
import java.util.Arrays;
import java.util.List;

import com.amazon.SellingPartnerAPIAA.LWAException;
import java.security.NoSuchAlgorithmException;
import java.io.InputStream;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.io.IOException;
import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

/**
 * Code Recipe to send a message to a buyer using the Messaging API
 * Steps:
 * 1. Initialize Messaging API client
 * 2. Get available message types for an order
 * 3. Send a customization details message to the buyer
 * 4. Display confirmation
 */
public class SendInvoiceToBuyer extends Recipe {

    private MessagingApi messagingApi;
    private UploadsApi uploadsApi;
    private String amazonOrderId;
    private List<String> marketplaceIds;

    @Override
    protected void start() {
        initializeMessagingApi();
        setupOrderDetails();
        GetMessagingActionsForOrderResponse actions = getAvailableMessageTypes();
        Boolean canSendInvoice = false;
        for (LinkObject link : actions.getLinks().getActions()) {
            System.out.println(link.getName().toString());
            if (link.getName().contains("sendInvoice")) {
                canSendInvoice = true;
            }
        }
        if (canSendInvoice) {
            System.out.println("✅ You can send an invoice for this order");
            initializeUploadsApi();
            String md5 = calculateMd5();
            System.out.println("MD5: " + md5);
            CreateUploadDestinationResponse response = createUploadDestination(md5, "application/pdf");
            System.out.println("Upload Destination created:");
            System.out.println(response);
            System.out.println("You can now upload your invoice to the URL provided in the response");

        } else {
            System.out.println("❌ You cannot send an invoice for this order");
            return;
        }
    }

    /**
     * Step 1: Initialize the Messaging API client with fresh credentials
     */
    private void initializeMessagingApi() {
        messagingApi = new MessagingApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint("https://sellingpartnerapi-na.amazon.com")
                .disableAccessTokenCache()
                .build();

        System.out.println("Messaging API client initialized");
        System.out.println(lwaCredentials);
        System.out.println("  Endpoint: " + lwaCredentials.getEndpoint());
        System.out.println("  Refresh Token: " + lwaCredentials.getRefreshToken());
        System.out.println("  Client ID: " + (lwaCredentials.getClientId() != null ? "[SET]" : "[NOT SET]"));
        System.out.println("  Client Secret: " + (lwaCredentials.getClientSecret() != null ? "[SET]" : "[NOT SET]"));
    }

    /**
     * Setup order details for the message
     */
    private void setupOrderDetails() {
        amazonOrderId = "701-6210829-5037842"; // Sample order ID
        marketplaceIds = Arrays.asList("A2Q3Y263D00KWC"); // BR marketplace

        System.out.println("Order details configured: " + amazonOrderId);
    }

    /**
     * Step 2: Get available message types for the order
     */
    private GetMessagingActionsForOrderResponse getAvailableMessageTypes() {
        try {
            GetMessagingActionsForOrderResponse messagingActionsResponse = messagingApi.getMessagingActionsForOrder(
                    amazonOrderId,
                    marketplaceIds);
            System.out.println("Retrieved available message types for order");
            System.out.println("Response: " + messagingActionsResponse);
            return (messagingActionsResponse);
        } catch (ApiException e) {
            System.out.println("API Error: " + e.getCode());
            System.out.println("Response: " + e.getResponseBody());
            throw new RuntimeException("Failed to get messaging actions", e);
        } catch (LWAException e) {
            throw new RuntimeException("Failed to get messaging actions", e);
        }
    }

    private void initializeUploadsApi() {
        System.out.println("=== UPLOADS API INITIALIZATION ===");
        
        uploadsApi = new UploadsApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint("https://sellingpartnerapi-na.amazon.com")
                .disableAccessTokenCache()
                .build();
        
        System.out.println("Uploads API client initialized");
        
        // Add interceptor to capture access token
        try {
            java.lang.reflect.Field apiClientField = uploadsApi.getClass().getDeclaredField("apiClient");
            apiClientField.setAccessible(true);
            software.amazon.spapi.ApiClient apiClient = (software.amazon.spapi.ApiClient) apiClientField.get(uploadsApi);
            
            okhttp3.OkHttpClient httpClient = apiClient.getHttpClient();
            okhttp3.OkHttpClient newClient = httpClient.newBuilder()
                .addInterceptor(new Interceptor() {
                    @Override
                    public Response intercept(Chain chain) throws java.io.IOException {
                        Request request = chain.request();
                        
                        System.out.println("\n=== FULL REQUEST LOG ===");
                        System.out.println("Method: " + request.method());
                        System.out.println("URL: " + request.url());
                        System.out.println("Headers:");
                        for (String name : request.headers().names()) {
                            System.out.println("  " + name + ": " + request.header(name));
                        }
                        if (request.body() != null) {
                            System.out.println("Body: " + request.body().toString());
                        }
                        System.out.println("=== END REQUEST LOG ===");
                        
                        return chain.proceed(request);
                    }
                })
                .build();
            
            java.lang.reflect.Field httpClientField = apiClient.getClass().getDeclaredField("httpClient");
            httpClientField.setAccessible(true);
            httpClientField.set(apiClient, newClient);
            
        } catch (Exception e) {
            System.out.println("Could not add interceptor: " + e.getMessage());
            e.printStackTrace();
        }
        
        System.out.println("=== INITIALIZATION COMPLETE ===");
    }

    private String calculateMd5() {
        String filePath = "src/main/java/messaging/invoice.pdf";
        try (InputStream is = new FileInputStream(filePath)) {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] buffer = new byte[4096];
            int read;
            while ((read = is.read(buffer)) > 0) {
                md.update(buffer, 0, read);
            }
            byte[] md5sum = md.digest();
            return java.util.Base64.getEncoder().encodeToString(md5sum);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 algorithm not found", e);
        } catch (IOException e) {
            throw new RuntimeException("Error reading file", e);
        }
    }

    private CreateUploadDestinationResponse createUploadDestination(String md5, String contentType) {
        System.out.println("=== CREATING UPLOAD DESTINATION ===");
        
        try {
            String resource = "messaging/v1/orders/" + amazonOrderId + "/messages/invoice";
            CreateUploadDestinationResponse response = uploadsApi.createUploadDestinationForResource(marketplaceIds,
                    md5, resource, contentType);
            System.out.println("✅ Upload destination created successfully");
            return response;
        } catch (ApiException e) {
            System.out.println("❌ API Error: " + e.getCode());
            System.out.println("Response: " + e.getResponseBody());
            throw new RuntimeException("Failed to create upload destination", e);
        } catch (LWAException e) {
            System.out.println("❌ LWA Error: " + e.getMessage());
            throw new RuntimeException("Failed to create upload destination", e);
        }
    }
}
