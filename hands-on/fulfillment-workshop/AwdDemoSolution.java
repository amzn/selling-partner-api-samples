import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import software.amazon.spapi.api.awd.v2024_05_09.AwdApi;
import software.amazon.spapi.models.awd.v2024_05_09.*;

public class Solution {

    public static void main(String[] args) {
        LWAAuthorizationCredentials lwaAuthorizationCredentials = LWAAuthorizationCredentials.builder()
                .clientId("clientId")
                .clientSecret("clientSecret")
                .refreshToken("refreshToken")
                .endpoint("https://5ff8e393-450c-49b1-9a36-e853181ba278.mock.pstmn.io/auth/o2/token")
                .build();

        AwdApi awdApi = new AwdApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint("https://5ff8e393-450c-49b1-9a36-e853181ba278.mock.pstmn.io")
                .build();

        // 1. Check Inbound Eligibility
        ProductQuantity productQuantity = new ProductQuantity();
        productQuantity.setSku("solo-sock-1234");
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

        DistributionPackageQuantity packageQuantity = new DistributionPackageQuantity();
        packageQuantity.setCount(1);
        packageQuantity.setDistributionPackage(distributionPackage);

        InboundPackages inboundPackages = new InboundPackages();
        inboundPackages.addPackagesToInboundItem(packageQuantity);

        InboundEligibility eligibilityResponse;
        try {
            eligibilityResponse = awdApi.checkInboundEligibility(inboundPackages);
            System.out.println("1. Check eligibility response: " + eligibilityResponse);
        } catch(Exception exception) {}

        // 2. Create Inbound
        Address address = new Address();
        address.addressLine1("2031 7th Ave");
        address.setPostalCode("98121");
        address.setCountryCode("US");
        address.setName("Harsh G.");
        address.setStateOrRegion("WA");

        InboundOrderCreationData inboundOrderCreationData = new InboundOrderCreationData();
        inboundOrderCreationData.addPackagesToInboundItem(packageQuantity);
        inboundOrderCreationData.setOriginAddress(address);

        String orderId = "";
        try {
            InboundOrderReference inboundOrderReference = awdApi.createInbound(inboundOrderCreationData);
            orderId = inboundOrderReference.getOrderId();
            System.out.println("2. Create inbound response: " + inboundOrderReference);
        } catch(Exception exception) {}

        // 3. Get Inbound
        try {
            InboundOrder inboundOrder = awdApi.getInbound(orderId);
            System.out.println("3. Get inbound response: " + inboundOrder);
        } catch (Exception exception) {}

        // 4. Confirm Inbound
        try {
            awdApi.confirmInbound(orderId);
            System.out.println("4. Congratulations! Inbound order is confirmed successfully.");
        } catch (Exception exception) {}
    }
}
