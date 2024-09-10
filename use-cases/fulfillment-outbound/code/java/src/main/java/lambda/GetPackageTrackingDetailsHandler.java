package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import lambda.utils.MCFTrackingDetailsLambdaInput;
import io.swagger.client.api.FbaOutboundApi;
import io.swagger.client.model.fbao.GetPackageTrackingDetailsResponse;

import static lambda.utils.ApiUtils.getFbaOutboundApi;

public class GetPackageTrackingDetailsHandler implements RequestHandler<MCFTrackingDetailsLambdaInput, MCFTrackingDetailsLambdaInput> {

    public MCFTrackingDetailsLambdaInput handleRequest(MCFTrackingDetailsLambdaInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("PackageTracking input: " + input.getPackageNumbers());

        try {
            FbaOutboundApi fbaoApi = getFbaOutboundApi(input.getRegionCode(), input.getRefreshToken());
            
            //For each package number, retrive the package details
            for (Integer packageNumber : input.getPackageNumbers()) {
                GetPackageTrackingDetailsResponse getPackageTrackingDetailsResponse = fbaoApi.getPackageTrackingDetails(packageNumber);

                logger.log("GetPackageTrackingDetails call output: " + getPackageTrackingDetailsResponse);    
            }
            
        } catch (Exception e) {
            throw new InternalError("Calling FBAOutbound GetPackageTrackingDetails failed", e);
        }

        return input;
    }
}