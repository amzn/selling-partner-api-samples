package b2bdeliveryexperience;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

import com.amazon.SellingPartnerAPIAA.LWAException;

import org.threeten.bp.OffsetDateTime;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.orders.v0.OrdersV0Api;
import software.amazon.spapi.models.orders.v0.Address.AddressTypeEnum;
import software.amazon.spapi.models.orders.v0.ConfirmShipmentOrderItem;
import software.amazon.spapi.models.orders.v0.ConfirmShipmentOrderItemsList;
import software.amazon.spapi.models.orders.v0.ConfirmShipmentRequest;
import software.amazon.spapi.models.orders.v0.GetOrderAddressResponse;
import software.amazon.spapi.models.orders.v0.GetOrderBuyerInfoResponse;
import software.amazon.spapi.models.orders.v0.GetOrderItemsResponse;
import software.amazon.spapi.models.orders.v0.GetOrderResponse;
import software.amazon.spapi.models.orders.v0.Order;
import software.amazon.spapi.models.orders.v0.OrderAddress;
import software.amazon.spapi.models.orders.v0.OrderBuyerInfo;
import software.amazon.spapi.models.orders.v0.OrderItem;
import software.amazon.spapi.models.orders.v0.PackageDetail;
import util.Constants;
import util.Recipe;

import static software.amazon.spapi.models.orders.v0.Address.AddressTypeEnum.COMMERCIAL;

/**
 * Amazon Business Delivery Experience is a six-step process:
 * 1) Get order details and check if it's a business order
 * 2) Retrieve purchase order number (RDT required)
 * 3) Get order address and verify it's commercial (RDT required)
 * 4) Filter carrier options to exclude weekend deliveries (for commercial addresses)
 * 5) Generate shipping label with PO number
 * 6) Confirm shipment with selected carrier
 * NOTE: Methods that access PII (buyer info, address) require a Restricted Data Token (RDT).
 */
public class BusinessDeliveryExperienceRecipe extends Recipe {

    private final OrdersV0Api ordersApi = new OrdersV0Api.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();

    @Override
    protected void start() {
        final String orderId = "123-4567890-1234567"; // Sample order ID

        Order order = getOrder(orderId);
        if (!isBusinessOrder(order)) {
            System.out.println("Not a business order; skipping business delivery flow.");
            return;
        }

        // RDT must be obtained before calling buyer info or address endpoints.
        String poNumber = getPurchaseOrderNumber(orderId);
        List<OrderItem> orderItems = getOrderItems(orderId);
        OrderAddress orderAddress = getOrderAddress(orderId);

        List<CarrierOption> carriers = getCarrierOptions();

        // Filter weekend deliveries only for commercial addresses
        if (isCommercialAddress(orderAddress)) {
            carriers = filterWeekendDeliveries(carriers);
        }

        CarrierOption selectedCarrier = selectCarrier(carriers);
        ShippingLabel label = generateShippingLabel(orderId, selectedCarrier, poNumber);
        confirmShipment(order, orderItems, selectedCarrier);
    }

    /**
     * Checks if an order is a business order.
     */
    private boolean isBusinessOrder(Order order) {
        return order != null && Boolean.TRUE.equals(order.isIsBusinessOrder());
    }

    /**
     * Gets order details - no Restricted Data Token required.
     */
    private Order getOrder(String orderId) {
        try {
            GetOrderResponse response = ordersApi.getOrder(orderId);
            return response.getPayload();
        } catch (ApiException e) {
            throw new RuntimeException("Unsuccessful response from Orders API", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }

    /**
     * Gets Purchase Order Number - REQUIRES Restricted Data Token (RDT) for PII access.
     * Obtain an RDT beforehand using the createRestrictedDataToken API.
     */
    private String getPurchaseOrderNumber(String orderId) {
        try {
            GetOrderBuyerInfoResponse buyerInfoResponse = ordersApi.getOrderBuyerInfo(orderId);
            OrderBuyerInfo buyerInfo = (buyerInfoResponse != null) ? buyerInfoResponse.getPayload() : null;
            return (buyerInfo != null) ? buyerInfo.getPurchaseOrderNumber() : null;
        } catch (ApiException e) {
            throw new RuntimeException("Unsuccessful response from Orders API", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }

    /**
     * Gets order items - no Restricted Data Token required.
     */
    private List<OrderItem> getOrderItems(String orderId) {
        try {
            GetOrderItemsResponse response = ordersApi.getOrderItems(orderId, null);
            return response.getPayload().getOrderItems();
        } catch (ApiException e) {
            throw new RuntimeException("Unsuccessful response from Orders API", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }

    /**
     * Gets order address - REQUIRES Restricted Data Token (RDT) for PII access.
     * Obtain an RDT beforehand using the createRestrictedDataToken API.
     */
    private OrderAddress getOrderAddress(String orderId) {
        try {
            GetOrderAddressResponse response = ordersApi.getOrderAddress(orderId);
            return response.getPayload(); // payload contains shippingAddress
        } catch (ApiException e) {
            throw new RuntimeException("Unsuccessful response from Orders API", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }

    // ---------- Helper / mock logic ----------

    /**
     * True if the shipping address type is "Commercial" (case-insensitive).
     */
    private boolean isCommercialAddress(OrderAddress orderAddress) {
        if (orderAddress == null || orderAddress.getShippingAddress() == null) return false;
        AddressTypeEnum addressType = orderAddress.getShippingAddress().getAddressType();
        return COMMERCIAL.equals(addressType);
    }

    /**
     * MOCK: Get available carrier options (replace with real carrier/shipping API integration).
     */
    private List<CarrierOption> getCarrierOptions() {
        return List.of(
                createCarrierOption("UPS", LocalDate.now().plusDays(1)),
                createCarrierOption("FedEx", LocalDate.now().plusDays(2)),
                createCarrierOption("DHL", LocalDate.now().plusDays(6)) // Saturday
        );
    }

    private CarrierOption createCarrierOption(String carrier, LocalDate deliveryDate) {
        CarrierOption option = new CarrierOption();
        option.setCarrierName(carrier);
        option.setEstimatedDeliveryDate(deliveryDate.toString());
        return option;
    }

    /**
     * MOCK METHOD: Filters out carriers that deliver on weekends
     * In real implementation, this would be part of carrier selection logic
     */
    private List<CarrierOption> filterWeekendDeliveries(List<CarrierOption> carriers) {
        return carriers.stream()
                .filter(c -> {
                    LocalDate date = LocalDate.parse(c.getEstimatedDeliveryDate());
                    DayOfWeek dow = date.getDayOfWeek();
                    return dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY;
                })
                .collect(Collectors.toList());
    }

    /**
     * Simple selection logic; pick first available.
     */
    private CarrierOption selectCarrier(List<CarrierOption> carriers) {
        return (carriers == null || carriers.isEmpty()) ? null : carriers.get(0);
    }

    /**
     * MOCK METHOD: Generates shipping label with purchase order number
     * In real implementation, this would integrate with SP-API Shipping API or carrier APIs
     */
    private ShippingLabel generateShippingLabel(String orderId, CarrierOption carrier, String poNumber) {
        if (carrier == null) {
            System.out.println("No carrier available for label generation");
            return null;
        }

        ShippingLabel label = new ShippingLabel();
        label.setLabelId("LBL-" + orderId + "-" + System.currentTimeMillis());
        label.setCarrierName(carrier.getCarrierName());
        label.setTrackingNumber("1Z999AA1234567890");
        label.setLabelFormat("PDF");
        label.setLabelUrl("https://mock-label-url.com/" + label.getLabelId() + ".pdf");
        label.setPurchaseOrderNumber(poNumber);

        System.out.println("Shipping label generated: " + label.getLabelId() +
                (poNumber != null ? " with PO: " + poNumber : ""));
        return label;
    }

    /**
     * Confirm shipment in Orders API.
     */
    private void confirmShipment(Order order, List<OrderItem> orderItems, CarrierOption carrier) {
        if (order == null || carrier == null || orderItems == null || orderItems.isEmpty()) {
            System.out.println("Missing data; cannot confirm shipment.");
            return;
        }

        try {
            ConfirmShipmentOrderItemsList confirmItems = new ConfirmShipmentOrderItemsList();
            orderItems.stream()
                    .map(item -> new ConfirmShipmentOrderItem()
                            .orderItemId(item.getOrderItemId())
                            .quantity(item.getQuantityOrdered()))
                    .forEach(confirmItems::add);

            ConfirmShipmentRequest request = new ConfirmShipmentRequest()
                    .marketplaceId(order.getMarketplaceId())
                    .packageDetail(new PackageDetail()
                            .packageReferenceId("PKG001")
                            .carrierCode(carrier.getCarrierName())
                            .trackingNumber("1Z999AA1234567890")
                            .orderItems(confirmItems)
                            .shipDate(OffsetDateTime.now()));

            ordersApi.confirmShipment(request, order.getAmazonOrderId());
            System.out.println("Shipment confirmed with carrier: " + carrier.getCarrierName());
        } catch (ApiException e) {
            throw new RuntimeException("Failed to confirm shipment", e);
        } catch (LWAException e) {
            throw new RuntimeException("Authentication error", e);
        }
    }

    // ---------- Mock DTOs (replace with real models if available) ----------

    private static class CarrierOption {
        private String carrierName;
        private String estimatedDeliveryDate;

        public String getCarrierName() {
            return carrierName;
        }

        public void setCarrierName(String carrierName) {
            this.carrierName = carrierName;
        }

        public String getEstimatedDeliveryDate() {
            return estimatedDeliveryDate;
        }

        public void setEstimatedDeliveryDate(String estimatedDeliveryDate) {
            this.estimatedDeliveryDate = estimatedDeliveryDate;
        }
    }

    private static class ShippingLabel {
        private String labelId;
        private String carrierName;
        private String trackingNumber;
        private String labelFormat;
        private String labelUrl;
        private String purchaseOrderNumber;

        public String getLabelId() {
            return labelId;
        }

        public void setLabelId(String labelId) {
            this.labelId = labelId;
        }

        public String getCarrierName() {
            return carrierName;
        }

        public void setCarrierName(String carrierName) {
            this.carrierName = carrierName;
        }

        public String getTrackingNumber() {
            return trackingNumber;
        }

        public void setTrackingNumber(String trackingNumber) {
            this.trackingNumber = trackingNumber;
        }

        public String getLabelFormat() {
            return labelFormat;
        }

        public void setLabelFormat(String labelFormat) {
            this.labelFormat = labelFormat;
        }

        public String getLabelUrl() {
            return labelUrl;
        }

        public void setLabelUrl(String labelUrl) {
            this.labelUrl = labelUrl;
        }

        public String getPurchaseOrderNumber() {
            return purchaseOrderNumber;
        }

        public void setPurchaseOrderNumber(String purchaseOrderNumber) {
            this.purchaseOrderNumber = purchaseOrderNumber;
        }
    }
}
