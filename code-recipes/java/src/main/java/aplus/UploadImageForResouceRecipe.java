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
            
            okhttp3.MultipartBody.Builder formBuilder = new okhttp3.MultipartBody.Builder()
                    .setType(okhttp3.MultipartBody.FORM);
            
            // Extract query parameters from URL and add as form fields
            java.net.URL url = new java.net.URL(uploadDestinationUrl);
            String query = url.getQuery();
            if (query != null) {
                String[] params = query.split("&");
                for (String param : params) {
                    String[] keyValue = param.split("=", 2);
                    if (keyValue.length == 2) {
                        String key = java.net.URLDecoder.decode(keyValue[0], "UTF-8");
                        String value = java.net.URLDecoder.decode(keyValue[1], "UTF-8");
                        formBuilder.addFormDataPart(key, value);
                    }
                }
            }
            
            // Add file as form field
            okhttp3.RequestBody fileBody = okhttp3.RequestBody.create(fileBytes, okhttp3.MediaType.get(contentType));
            formBuilder.addFormDataPart("File", "test_image.jpg", fileBody);
            
            okhttp3.RequestBody requestBody = formBuilder.build();
            
            // Use base URL without query parameters
            String baseUrl = uploadDestinationUrl.split("\\?")[0];
            okhttp3.Request request = new okhttp3.Request.Builder()
                    .url(baseUrl)
                    .post(requestBody)
                    .build();

            okhttp3.OkHttpClient client = new okhttp3.OkHttpClient();
            try (okhttp3.Response response = client.newCall(request).execute()) {
                System.out.println("Upload response code: " + response.code());
                return response.isSuccessful();
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to upload image", e);
        }
    }
}