package easyship;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.easyship.v2022_03_23.EasyShipApi;
import software.amazon.spapi.models.easyship.v2022_03_23.ModelPackage;
import util.Recipe;
import util.Constants;

import com.amazon.SellingPartnerAPIAA.LWAException;

/**
 * Code Recipe to retrieve a scheduled EasyShip package
 * Steps:
 * 1. Initialize EasyShip API client
 * 2. Call getScheduledPackage operation
 * 3. Validate Scheduled Package Id
 */
public class GetScheduledPackageRecipe extends Recipe {

    private EasyShipApi easyShipApi;
    private String amazonOrderId;
    private String marketplaceId;

    @Override
    protected void start() {
        initializeEasyShipApi();
        ModelPackage packageResponse = getScheduledPackage();
        validateScheduledPackageId(packageResponse);
        System.out.println("✅ Successfully retrieved and validated scheduled package");
    }

    private void initializeEasyShipApi() {
        easyShipApi = new EasyShipApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        amazonOrderId = "902-3159121-1390916";
        marketplaceId = "A1AM78C64UM0Y8";
        System.out.println("EasyShip API client initialized");
    }

    private ModelPackage getScheduledPackage() {
        try {
            ModelPackage response = easyShipApi.getScheduledPackage(amazonOrderId, marketplaceId);
            System.out.println("Scheduled package retrieved for order: " + amazonOrderId);
            return response;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to get scheduled package", e);
        }
    }

    private void validateScheduledPackageId(ModelPackage packageResponse) {
        String responseOrderId = packageResponse.getScheduledPackageId().getAmazonOrderId();
        if (!amazonOrderId.equals(responseOrderId)) {
            throw new IllegalStateException("Scheduled Package Id mismatch. Expected: " + amazonOrderId + ", Got: " + responseOrderId);
        }
        System.out.println("✅ Scheduled Package Id validated: " + responseOrderId);
    }
}
