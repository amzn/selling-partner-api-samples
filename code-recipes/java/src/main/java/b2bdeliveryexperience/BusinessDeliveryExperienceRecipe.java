package b2bdeliveryexperience;

import com.amazon.SellingPartnerAPIAA.LWAException;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.orders.OrdersV0Api;
import software.amazon.spapi.models.orders.*;
import util.Constants;
import util.Recipe;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Amazon Business Delivery Experience is a seven-step process:
 * - Get order details and check if it's a business order
 * - Retrieve purchase order number for business orders
 * - Get order address and verify it's commercial
 * - Get delivery preferences for the order
 * - Filter carrier options to exclude weekend deliveries
 * - Generate shipping label with PO number
 * - Confirm shipment with selected carrier
 */
public class BusinessDeliveryExperienceRecipe extends Recipe {

    private final OrdersV0Api ordersApi = new OrdersV0Api.Builder()
            .lwaAuthorizationCredentials(lwaCredentials)
            .endpoint(Constants.BACKEND_URL)
            .build();


    @Override
    protected void start() {
        String orderId = "123-4567890-1234567"; // Sample order ID

        Order order = getOrder(orderId);

        if (Boolean.TRUE.equals(order.isIsBusinessOrder())) {
            String poNumber = getPurchaseOrderNumber(orderId);
            List<OrderItem> orderItems = getOrderItems(orderId);
            OrderAddress address = getOrderAddress(orderId);

            DeliveryPreferences preferences = address.getDeliveryPreferences();
            List<CarrierOption> carriers = getCarrierOptions();

            // Filter weekend deliveries only for commercial addresses
            if ("Commercial".equalsIgnoreCase(address.getShippingAddress().getAddressType())) {
                carriers = filterWeekendDeliveries(carriers);
            }

            CarrierOption selectedCarrier = selectCarrier(carriers);
            ShippingLabel label = generateShippingLabel(orderId, selectedCarrier, poNumber);
            confirmShipment(order, orderItems, selectedCarrier);
        }
    }

    /**
     * Gets order details - no Restricted Data Token required
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
     * Gets Purchase Order Number - REQUIRES Restricted Data Token (RDT) for PII access
     * Must obtain RDT before calling this method using createRestrictedDataToken API
     */
    private String getPurchaseOrderNumber(orderId) {
        try {
            GetOrderBuyerInfoResponse buyerInfoResponse = ordersApi.getOrderBuyerInfo(orderId);
            BuyerInfo buyerInfo = buyerInfoResponse.getPayload();
            return (buyerInfo != null) ? buyerInfo.getPurchaseOrderNumber() : null;

        }
    } catch(
    ApiException e)

    {
        throw new RuntimeException("Unsuccessful response from Orders API", e);
    } catch(
    LWAException e)

    {
        throw new RuntimeException("Authentication error", e);
    }
}


/**
 * Gets order items - no Restricted Data Token required
 */
private List<OrderItem> getOrderItems(String orderId) {
    try {
        GetOrderItemsResponse response = ordersApi.getOrderItems(orderId);
        return response.getPayload().getOrderItems();
    } catch (ApiException e) {
        throw new RuntimeException("Unsuccessful response from Orders API", e);
    } catch (LWAException e) {
        throw new RuntimeException("Authentication error", e);
    }
}

/**
 * Gets order address - REQUIRES Restricted Data Token (RDT) for PII access
 * Must obtain RDT before calling this method using createRestrictedDataToken API
 */
private OrderAddress getOrderAddress(String orderId) {
    try {
        GetOrderAddressResponse response = ordersApi.getOrderAddress(orderId);
        return response.getPayload();
    } catch (ApiException e) {
        throw new RuntimeException("Unsuccessful response from Orders API", e);
    } catch (LWAException e) {
        throw new RuntimeException("Authentication error", e);
    }
}

/**
 * MOCK METHOD: Gets available carrier options
 * In real implementation, this would integrate with shipping APIs to get actual carrier options
 */
private List<CarrierOption> getCarrierOptions() {
    // Mock carrier options - in real implementation, this would come from shipping API
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
            .filter(carrier -> {
                LocalDate deliveryDate = LocalDate.parse(carrier.getEstimatedDeliveryDate());
                DayOfWeek dayOfWeek = deliveryDate.getDayOfWeek();
                return dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY;
            })
            .collect(Collectors.toList());
}

private CarrierOption selectCarrier(List<CarrierOption> carriers) {
    // Select first available carrier (in real implementation, this would be user choice)
    return carriers.isEmpty() ? null : carriers.get(0);
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

    // Mock shipping label generation - in real implementation, this would call shipping API
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

private void confirmShipment(Order order, List<OrderItem> orderItems, CarrierOption carrier) {
    if (carrier == null) {
        System.out.println("No carrier available for shipment");
        return;
    }

    try {
        List<ConfirmShipmentOrderItem> confirmItems = orderItems.stream()
                .map(item -> new ConfirmShipmentOrderItem()
                        .orderItemId(item.getOrderItemId())
                        .quantity(item.getQuantityOrdered()))
                .collect(Collectors.toList());
        ConfirmShipmentRequest request = new ConfirmShipmentRequest()
                .marketplaceId(order.getMarketplaceId())
                .packageDetail(new PackageDetail()
                        .packageReferenceId("PKG001")
                        .carrierCode(carrier.getCarrierName())
                        .trackingNumber("1Z999AA1234567890")
                        .orderItems(confirmItems));

        ordersApi.confirmShipment(order.getAmazonOrderId(), request);
        System.out.println("Shipment confirmed with carrier: " + carrier.getCarrierName());
    } catch (ApiException e) {
        throw new RuntimeException("Failed to confirm shipment", e);
    } catch (LWAException e) {
        throw new RuntimeException("Authentication error", e);
    }
}

// Mock CarrierOption class - replace with actual SP-API model
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

// Mock ShippingLabel class - replace with actual SP-API model
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

public static void main(String[] args) {
    new BusinessDeliveryExperienceRecipe().start();
}
}}

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