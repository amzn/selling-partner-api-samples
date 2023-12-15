using Amazon.Lambda.Core;
using Amazon.Scheduler;
using Amazon.Scheduler.Model;
using Newtonsoft.Json;
using SpApiCsharpApp;
using SpApiCsharpApp.lambda.utils;
using SpApiCsharpApp.swaggerClient.Api;
using SpApiCsharpApp.swaggerClient.Model.Solicitations;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]
namespace SpApiCsharpApp
{
    public class GetSolictitationActionsHandler
    {
        private static String MarketplaceIdKeyName = "MarketplaceId";
        private static String OrderKeyName = "OrderId";
        private static String ScheduleKeyName = "ScheduleName";

        /* Sample event input
        {
            "OrderId": "123-1234567-1234567",
            "MarketplaceId": "ATVPDKIKX0DER",
            "ScheduleName": "event-bridge-schedule-name-123",
        }
        */
        public async Task<object> FunctionHandlerAsync(GetSolicitationOrderInput inputOrder, ILambdaContext context)
        {
            ILambdaLogger logger = context.Logger;
            logger.LogLine("Get Solicitation Actions handler started");
            logger.LogLine("Input: " + JsonConvert.SerializeObject(inputOrder));

            // Delete EventBridge schedule if exists   
            String scheduleName = inputOrder.ScheduleName; 

            try
            {
                var schedulerClient = new AmazonSchedulerClient();
                var deleteScheduleRequest = new DeleteScheduleRequest { Name = scheduleName };
                var deleteScheduleResponse = await schedulerClient.DeleteScheduleAsync(deleteScheduleRequest);
                logger.LogLine("Schedule successfully deleted");
            }
            catch (ResourceNotFoundException ex)
            {
                logger.LogLine("Schedule doesn't exist");
            }

            // Pass in variables for execution
            String amazonOrderId = inputOrder.OrderId;
            String marketplaceId = inputOrder.MarketplaceId; 
            String regionCode = Constants.MarketplaceIdToRegionCodeMapping.GetValueOrDefault(marketplaceId, Constants.SandboxRegionCode);
            String ? refreshToken = Environment.GetEnvironmentVariable(Constants.RefreshTokenKeyName);

            // call Solicitation API
            SolicitationsApi solicitationApi = ApiUtils.GetSolicitationsApi(regionCode, refreshToken);

            // Get solicitation actions for the order and marketplace
            GetSolicitationActionsForOrderResponse getSolicitationsActionsResponse = solicitationApi.GetSolicitationActionsForOrder(amazonOrderId, new List<String> { marketplaceId }); 

            // If response is not null, validate response
            if (getSolicitationsActionsResponse != null)
            {
                logger.LogLine("Result: " + JsonConvert.SerializeObject(getSolicitationsActionsResponse));
                var solicitationsLinks = getSolicitationsActionsResponse.Links;

                // If links are not null then there are valid actions to execute on the order
                if (solicitationsLinks != null)
                {
                    foreach (var action in solicitationsLinks.Actions)
                    {
                        var actionName = action.Name;
                        var actionHref = action.Href;
                        // Check for action name ='productReviewAndSellerFeedback' to confirm solicitation can be sent to the buyer
                        if (actionName == Constants.ActionProductReviewSellerFeedback)
                        {
                            return
                               new
                               {
                                   ActionName = actionName,
                                   ActionHref = actionHref
                               };
                        }

                    }
                }
                else
                {
                    logger.LogLine("Error while calling GetSolicitationsActionsForOrder");
                }
            }
            return null;

        }

    }

}




