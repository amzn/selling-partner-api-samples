package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.google.gson.Gson;
import io.swagger.client.api.MerchantFulfillmentApi;
import io.swagger.client.model.mfn.GetEligibleShipmentServicesRequest;
import io.swagger.client.model.mfn.GetEligibleShipmentServicesResponse;
import io.swagger.client.model.mfn.ShipmentRequestDetails;
import lambda.utils.MfnLambdaInput;
import lambda.utils.MfnOrder;

import static lambda.utils.ApiUtils.getMFNApi;
import static lambda.utils.MfnUtils.getDefaultShippingServiceOptions;
import static lambda.utils.MfnUtils.getItemList;

public class EligibleShipmentHandler implements RequestHandler<MfnLambdaInput, MfnOrder> {

    public MfnOrder handleRequest(MfnLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("EligibleShipment Lambda input: " + input);

        MfnOrder mfnOrder = input.getMfnOrder();

        try {
            //Get eligible shipment services for the order
            GetEligibleShipmentServicesRequest request = new GetEligibleShipmentServicesRequest()
                    .shipmentRequestDetails(new ShipmentRequestDetails()
                        .amazonOrderId(input.getOrderId())
                        .itemList(getItemList(mfnOrder.getOrderItems()))
                        .shipFromAddress(mfnOrder.getShipFromAddress())
                        .packageDimensions(mfnOrder.getPackageDimensions())
                        .weight(mfnOrder.getWeight())
                        .shippingServiceOptions(getDefaultShippingServiceOptions()));

            logger.log("Merchant Fulfillment API - GetEligibleShipmentServices request: " + new Gson().toJson(request));

            MerchantFulfillmentApi mfnApi = getMFNApi(input.getRegionCode(), input.getRefreshToken());
            GetEligibleShipmentServicesResponse response = mfnApi.getEligibleShipmentServices(request);

            mfnOrder.setShippingServiceList(response.getPayload().getShippingServiceList());
            return mfnOrder;
        } catch (JsonProcessingException e) {
            throw new InternalError("Message body could not be mapped to MfnOrder", e);
        } catch (Exception e) {
            throw new InternalError("Calling Merchant Fulfillment API failed", e);
        }
    }
}
