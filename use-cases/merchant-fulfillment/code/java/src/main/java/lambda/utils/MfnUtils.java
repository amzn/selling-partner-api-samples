package lambda.utils;

import io.swagger.client.model.mfn.DeliveryExperienceType;
import io.swagger.client.model.mfn.Item;
import io.swagger.client.model.mfn.ItemList;
import io.swagger.client.model.mfn.LabelFormat;
import io.swagger.client.model.mfn.ShippingServiceOptions;

import java.util.List;

public class MfnUtils {

    //Default shipping service options
    private static DeliveryExperienceType DELIVERY_EXPERIENCE_TYPE = DeliveryExperienceType.DELIVERYCONFIRMATIONWITHOUTSIGNATURE;
    private static boolean CARRIER_WILL_PICK_UP = false;
    private static LabelFormat LABEL_FORMAT = LabelFormat.PNG;

    public static ItemList getItemList(List<MfnOrderItem> mfnOrderItems) {
        ItemList itemList = new ItemList();

        for (MfnOrderItem mfnOrderItem : mfnOrderItems) {
            Item item = new Item();
            item.setOrderItemId(mfnOrderItem.getOrderItemId());
            item.setQuantity(mfnOrderItem.getQuantity());

            itemList.add(item);
        }

        return itemList;
    }

    public static ShippingServiceOptions getDefaultShippingServiceOptions() {
        return new ShippingServiceOptions()
                .deliveryExperience(DELIVERY_EXPERIENCE_TYPE)
                .carrierWillPickUp(CARRIER_WILL_PICK_UP)
                .labelFormat(LABEL_FORMAT);
    }
}
