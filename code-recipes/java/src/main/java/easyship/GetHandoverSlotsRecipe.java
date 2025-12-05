package easyship;

import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.easyship.v2022_03_23.EasyShipApi;
import software.amazon.spapi.models.easyship.v2022_03_23.Dimensions;
import software.amazon.spapi.models.easyship.v2022_03_23.ListHandoverSlotsRequest;
import software.amazon.spapi.models.easyship.v2022_03_23.ListHandoverSlotsResponse;
import software.amazon.spapi.models.easyship.v2022_03_23.TimeSlot;
import software.amazon.spapi.models.easyship.v2022_03_23.UnitOfLength;
import software.amazon.spapi.models.easyship.v2022_03_23.UnitOfWeight;
import software.amazon.spapi.models.easyship.v2022_03_23.Weight;
import util.Constants;
import util.Recipe;

import com.amazon.SellingPartnerAPIAA.LWAException;

/**
 * Code Recipe to get available handover time slots for EasyShip orders
 * Steps:
 * 1. Setup order and package details
 * 2. Initialize EasyShip API client
 * 3. Create request with package dimensions and weight
 * 4. Call listHandoverSlots API
 * 5. Display available time slots
 */
public class GetHandoverSlotsRecipe extends Recipe {

    private EasyShipApi easyShipApi;
    private String amazonOrderId;
    private String marketplaceId;

    @Override
    protected void start() {
        setupOrderDetails();
        initializeEasyShipApi();
        ListHandoverSlotsResponse response = listHandoverSlots();
        displayTimeSlots(response);
        System.out.println("✅ Successfully retrieved handover slots");
    }

    private void setupOrderDetails() {
        amazonOrderId = "702-3035602-4225066";
        marketplaceId = "A1AM78C64UM0Y8";
        System.out.println("Order details configured: " + amazonOrderId);
    }

    private void initializeEasyShipApi() {
        easyShipApi = new EasyShipApi.Builder()
                .lwaAuthorizationCredentials(lwaCredentials)
                .endpoint(Constants.BACKEND_URL)
                .disableAccessTokenCache()
                .build();
        System.out.println("EasyShip API client initialized");
    }

    private ListHandoverSlotsResponse listHandoverSlots() {
        try {
            ListHandoverSlotsRequest request = new ListHandoverSlotsRequest()
                    .amazonOrderId(amazonOrderId)
                    .marketplaceId(marketplaceId)
                    .packageDimensions(createPackageDimensions())
                    .packageWeight(createPackageWeight());

            ListHandoverSlotsResponse response = easyShipApi.listHandoverSlots(request);
            System.out.println("Handover slots retrieved for order: " + amazonOrderId);
            return response;
        } catch (ApiException | LWAException e) {
            throw new RuntimeException("Failed to list handover slots", e);
        }
    }

    private Dimensions createPackageDimensions() {
        // TODO: In production, retrieve actual dimensions from CalculateOrderDimensionsRecipe
        // These are sample values for demonstration purposes only
        return new Dimensions()
                .length(10.0f)
                .width(8.0f)
                .height(5.0f)
                .unit(UnitOfLength.CM);
    }

    private Weight createPackageWeight() {
        // TODO: In production, retrieve actual dimensions from CalculateOrderDimensionsRecipe
        // These are sample values for demonstration purposes only
        return new Weight()
                .value(500.0f)
                .unit(UnitOfWeight.G);
    }

    private void displayTimeSlots(ListHandoverSlotsResponse response) {
        if (response.getTimeSlots() == null || response.getTimeSlots().isEmpty()) {
            System.out.println("No time slots available");
            return;
        }
        System.out.println("Available time slots: " + response.getTimeSlots().size());
        for (TimeSlot slot : response.getTimeSlots()) {
            System.out.println("  Slot ID: " + slot.getSlotId());
            System.out.println("    Method: " + slot.getHandoverMethod());
        }
    }
}
