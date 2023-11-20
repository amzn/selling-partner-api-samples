package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.model.mfn.ShippingService;
import io.swagger.client.model.mfn.ShippingServiceList;
import lambda.utils.MfnOrder;

import java.util.Collections;
import java.util.Comparator;

import static lambda.utils.Constants.SHIPMENT_FILTER_TYPE_CHEAPEST;
import static lambda.utils.Constants.SHIPMENT_FILTER_TYPE_ENV_VARIABLE;
import static lambda.utils.Constants.SHIPMENT_FILTER_TYPE_FASTEST;

public class SelectShipmentHandler implements RequestHandler<MfnOrder, MfnOrder> {

    public MfnOrder handleRequest(MfnOrder input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("SelectShipment Lambda input: " + new Gson().toJson(input));

        try {
            ShippingServiceList shippingServices = input.getShippingServiceList();

            if (shippingServices.size() == 0) {
                throw new InternalError("There are no shipping services to fulfill the order");
            }

            //Select the shipping service based on the preference (cheapest/fastest)
            input.setPreferredShippingService(getPreferredShipment(shippingServices));
            return input;
        } catch (Exception e) {
            throw new InternalError("Calling Merchant Fulfillment API failed", e);
        }
    }

    private ShippingService getPreferredShipment(ShippingServiceList shippingServices) {
        //Get the shipping preference from the Lambda function's environment variable
        //Update this section to match your product's logic
        String shipmentFilterType = System.getenv(SHIPMENT_FILTER_TYPE_ENV_VARIABLE);

        if (shipmentFilterType.equals(SHIPMENT_FILTER_TYPE_CHEAPEST)) {
            Collections.sort(shippingServices, new PriceComparator());
        } else if (shipmentFilterType.equals(SHIPMENT_FILTER_TYPE_FASTEST)){
            Collections.sort(shippingServices, new SpeedComparator());
        }

        return shippingServices.get(0);
    }

    private class PriceComparator implements Comparator<ShippingService> {
        public int compare(ShippingService a, ShippingService b) {
            return a.getRate().getAmount().compareTo(b.getRate().getAmount());
        }
    }

    private class SpeedComparator implements Comparator<ShippingService> {
        public int compare(ShippingService a, ShippingService b) {
            return a.getEarliestEstimatedDeliveryDate().compareTo(b.getLatestEstimatedDeliveryDate());
        }
    }
}
