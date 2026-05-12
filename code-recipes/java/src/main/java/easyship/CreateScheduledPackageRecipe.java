package easyship;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.easyship.v2022_03_23.EasyShipApi;
import software.amazon.spapi.models.easyship.v2022_03_23.CreateScheduledPackageRequest;
import software.amazon.spapi.models.easyship.v2022_03_23.HandoverMethod;
import software.amazon.spapi.models.easyship.v2022_03_23.ModelPackage;
import software.amazon.spapi.models.easyship.v2022_03_23.PackageDetails;
import software.amazon.spapi.models.easyship.v2022_03_23.TimeSlot;
import util.Recipe;
import util.Constants;

import com.amazon.SellingPartnerAPIAA.LWAException;

/**
 * Code Recipe to create a scheduled EasyShip package
 * Steps:
 * 1. Prepare CreateScheduledPackageRequest with preferred shipment handover slots
 * 2. Initialize EasyShip API client
 * 3. Return Scheduled Package Id for confirmation
 */
public class CreateScheduledPackageRecipe extends Recipe {

    private EasyShipApi easyShipApi;
    private String amazonOrderId;
    private String marketplaceId;

    @Override
    protected void start() {
        CreateScheduledPackageRequest request = prepareRequest();
        initializeEasyShipApi();
        ModelPackage packageResponse = createScheduledPackage(request);
        String scheduledPackageId = packageResponse.getScheduledPackageId().getAmazonOrderId();
        System.out.println("✅ Scheduled Package Id: " + scheduledPackageId);
    }

    private CreateScheduledPackageRequest prepareRequest() {
        amazonOrderId = "702-3035602-4225066";
        marketplaceId = "A1AM78C64UM0Y8";
        
        TimeSlot timeSlot = new TimeSlot()
                // TODO: In production, retrieve actual slot ID from GetHandoverSlotsRecipe
                // This is a sample value for demonstration purposes only
                .slotId("AQc1HTgeAAAAAJhLqlEAAAAAyE8AAAAAAAA=")
                .handoverMethod(HandoverMethod.PICKUP);

        PackageDetails packageDetails = new PackageDetails()
                .packageTimeSlot(timeSlot);

        CreateScheduledPackageRequest request = new CreateScheduledPackageRequest()
                .amazonOrderId(amazonOrderId)
                .marketplaceId(marketplaceId)
                .packageDetails(packageDetails);

        System.out.println("Request prepared with time slot: AQc1HTgeAAAAAJhLqlEAAAAAyE8AAAAAAAA=");
        return request;
    }

    private void initializeEasyShipApi() {
        easyShipApi = new EasyShipApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("EasyShip API client initialized");
    }

    private ModelPackage createScheduledPackage(CreateScheduledPackageRequest request) {
        try {
            ModelPackage response = easyShipApi.createScheduledPackage(request);
            System.out.println("Scheduled package created for order: " + amazonOrderId);
            return response;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to create scheduled package", e);
        }
    }
}
