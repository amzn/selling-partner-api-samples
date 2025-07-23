package awd;

import com.amazon.SellingPartnerAPIAA.LWAException;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.awd.v2024_05_09.AwdApi;
import software.amazon.spapi.models.awd.v2024_05_09.*;
import util.Constants;
import util.Recipe;

/**
 * AWD Inbound order creation is a simple four-step process:
 * - Check inbound eligibility (optional) - Make sure that your inventory is accepted by AWD.
 * - Create inbound order - Submit all necessary information to create a new inbound order.
 * - Get inbound order - Before confirmation, verify that all information is correct.
 * - Confirm inbound order - Confirm inbound order to let AWD know that your order is ready to ship.
 */
public class InboundOrderCreationRecipe extends Recipe {

    private final AwdApi awdApi = new AwdApi.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    private final DistributionPackageQuantity packageQuantity = new DistributionPackageQuantity();

    @Override
    protected void start() {
        InboundEligibilityStatus status = checkInboundEligibility();

        if (status == InboundEligibilityStatus.ELIGIBLE) {
            String orderId = createInbound();
            getInbound(orderId);
            confirmInbound(orderId);
        }
    }

    private InboundEligibilityStatus checkInboundEligibility() {
        ProductQuantity productQuantity = new ProductQuantity();
        productQuantity.setSku("test-socks");
        productQuantity.setQuantity(100);

        DistributionPackageContents contents = new DistributionPackageContents();
        contents.addProductsItem(productQuantity);

        PackageWeight packageWeight = new PackageWeight();
        packageWeight.setUnitOfMeasurement(WeightUnitOfMeasurement.KILOGRAMS);
        packageWeight.setWeight(6.0);

        MeasurementData measurementData = new MeasurementData();
        measurementData.weight(packageWeight);

        DistributionPackage distributionPackage = new DistributionPackage();
        distributionPackage.setContents(contents);
        distributionPackage.setMeasurements(measurementData);
        distributionPackage.setType(DistributionPackageType.CASE);

        packageQuantity.setCount(1);
        packageQuantity.setDistributionPackage(distributionPackage);

        InboundPackages inboundPackages = new InboundPackages();
        inboundPackages.addPackagesToInboundItem(packageQuantity);

        try {
            InboundEligibility response = awdApi.checkInboundEligibility(inboundPackages);
            return response.getStatus();
        } catch (ApiException e) {
            throw new RuntimeException("Unsuccessful response from AWD API", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }

    private String createInbound() {
        Address address = new Address();
        address.addressLine1("2031 7th Ave");
        address.setPostalCode("98121");
        address.setCountryCode("US");
        address.setName("John Doe");
        address.setStateOrRegion("WA");

        InboundOrderCreationData inboundOrderCreationData = new InboundOrderCreationData();
        inboundOrderCreationData.addPackagesToInboundItem(packageQuantity);
        inboundOrderCreationData.setOriginAddress(address);

        try {
            InboundOrderReference response = awdApi.createInbound(inboundOrderCreationData);
            return response.getOrderId();
        } catch (ApiException e) {
            throw new RuntimeException("Unsuccessful response from AWD API", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }

    private void getInbound(String orderId) {
        try {
            awdApi.getInbound(orderId);
        } catch (ApiException e) {
            throw new RuntimeException("Unsuccessful response from AWD API", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }

    private void confirmInbound(String orderId) {
        try {
            awdApi.confirmInbound(orderId);
        } catch (ApiException e) {
            throw new RuntimeException("Unsuccessful response from AWD API", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }
}
