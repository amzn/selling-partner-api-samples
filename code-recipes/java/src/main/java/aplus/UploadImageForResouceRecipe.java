package aplus;

import software.amazon.spapi.ApiException;
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
import java.io.ByteArrayOutputStream;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.stream.Collectors;

/** 
 * Code Recipe to upload an image to A+ Content API
 * Steps:
 * 1. Setup Images Details.
 * 2. Initialize Uploads API client
 * 3. Calculate B64 encoded MD5 Hash for Image file
 * 4. Create Upload Destination
 * 5. Upload Image to URL
 */

public class UploadImageForResouceRecipe extends Recipe {

    private UploadsApi uploadsApi;
    private List<String> marketplaceIds;
    private String imageFilePath;
    private String contentType;

    @Override
    protected void start() {
        setupImageDetails();
        initializeUploadsApi();
        String md5 = calculateMd5();
        CreateUploadDestinationResponse response = createUploadDestination(md5);
        Boolean uploaded = uploadImage(response.getPayload().getUrl(), response);
        if (uploaded) {
            System.out.println("✅ Image uploaded successfully");
            System.out.println("Upload Destination ID: " + response.getPayload().getUploadDestinationId());
        } else {
            System.out.println("❌ Failed to upload image");
        }
    }

    private void setupImageDetails() {
        marketplaceIds = Arrays.asList("A2Q3Y263D00KWC");
        imageFilePath = "src/main/resources/test_image.jpg";
        contentType = "image/jpeg";
        System.out.println("Image details configured: " + imageFilePath);
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
        try (InputStream is = new FileInputStream(imageFilePath)) {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] buffer = new byte[4096];
            int read;
            while ((read = is.read(buffer)) > 0) {
                md.update(buffer, 0, read);
            }
            System.out.println("MD5: " + java.util.Base64.getEncoder().encodeToString(md.digest()));
            return java.util.Base64.getEncoder().encodeToString(md.digest());
        } catch (NoSuchAlgorithmException | IOException e) {
            throw new RuntimeException("Error calculating MD5", e);
        }
    }

    private CreateUploadDestinationResponse createUploadDestination(String md5) {
        try {
            String resource = "aplus/2020-11-01/contentDocuments";
            CreateUploadDestinationResponse response = uploadsApi.createUploadDestinationForResource(marketplaceIds, md5, resource, contentType);
            System.out.println("Upload URL: " + response.getPayload().getUrl());
            return response;
        } catch (ApiException | LWAException e) {
            System.out.println("Failed to create upload destination: " + e);
            throw new RuntimeException("Failed to create upload destination", e);
        }
    }

    private Boolean uploadImage(String uploadDestinationUrl, CreateUploadDestinationResponse uploadResponse) {
        try (InputStream is = new FileInputStream(imageFilePath)) {
            byte[] fileBytes = is.readAllBytes();
            String boundary = "----WebKitFormBoundary" + System.currentTimeMillis();
            
            byte[] requestBody = buildMultipartBody(uploadDestinationUrl, fileBytes, contentType, boundary);
            String baseUrl = uploadDestinationUrl.split("\\?")[0];
            
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(baseUrl))
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(requestBody))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .build();
            
            java.net.http.HttpResponse<String> response = client.send(request, 
                    java.net.http.HttpResponse.BodyHandlers.ofString());
            System.out.println("Upload response code: " + response.statusCode());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (IOException | InterruptedException e) {
            throw new RuntimeException("Failed to upload image", e);
        }
    }
    
    private byte[] buildMultipartBody(String url, byte[] fileBytes, String contentType, String boundary) 
            throws IOException {
        
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            // Add query parameters as form fields
            Map<String, String> queryParams = extractQueryParameters(url);
            for (Map.Entry<String, String> param : queryParams.entrySet()) {
                String fieldHeader = String.format("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n", 
                    boundary, param.getKey(), param.getValue());
                output.write(fieldHeader.getBytes(StandardCharsets.UTF_8));
            }
            
            // Add file field
            String fileHeader = String.format("--%s\r\nContent-Disposition: form-data; name=\"File\"; filename=\"test_image.jpg\"\r\nContent-Type: %s\r\n\r\n", 
                boundary, contentType);
            output.write(fileHeader.getBytes(StandardCharsets.UTF_8));
            output.write(fileBytes);
            
            // Add closing boundary
            output.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            
            return output.toByteArray();
        }
    }
    
    private Map<String, String> extractQueryParameters(String urlString) throws IOException {
        try {
            URL url = new URL(urlString);
            String query = url.getQuery();
            
            if (query == null || query.isEmpty()) {
                return Map.of();
            }
            
            return Arrays.stream(query.split("&"))
                    .map(param -> param.split("=", 2))
                    .filter(keyValue -> keyValue.length == 2)
                    .collect(Collectors.toMap(
                            keyValue -> URLDecoder.decode(keyValue[0], StandardCharsets.UTF_8),
                            keyValue -> URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8)
                    ));
        } catch (Exception e) {
            throw new IOException("Failed to parse URL: " + urlString, e);
        }
    }
}