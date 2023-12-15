using Amazon.Lambda.Core;
using Amazon.Scheduler;
using Amazon.Scheduler.Model;
using Amazon.SellingPartnerAPIAA;
using Amazon.Lambda;
using SpApiCsharpApp;
using Newtonsoft.Json;
using SpApiCsharpApp.swaggerClient.Api;
using SpApiCsharpApp.swaggerClient.Model;
using System;
using Amazon.Runtime.Internal.Util;
using SpApiCsharpApp.swaggerClient.Model.Solicitations;
using System.Text.Json;
using SpApiCsharpApp.lambda.utils;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
//[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]
namespace SpApiCsharpApp
{
    public class SubmitSolictitationHandler
    {
        private static String MarketplaceIdKeyName = "MarketplaceId";
        private static String OrderKeyName = "OrderId";       

        /* Sample event input
        {
            "OrderId": "123-1234567-1234567",
            "MarketplaceId": "ATVPDKIKX0DER"
        }
        */
        public String FunctionHandler(SubmitSolicitationOrderInput input, ILambdaContext context)
        {
            ILambdaLogger logger = context.Logger;
            logger.LogLine("Submit Solicitation handler started");
            logger.LogLine("Input: " + JsonConvert.SerializeObject(input)) ;

            // Pass in variables for execution

            String amazonOrderId = input.OrderId; 
            String marketplaceId = input.MarketplaceId; 
            String regionCode = Constants.MarketplaceIdToRegionCodeMapping.GetValueOrDefault(marketplaceId, Constants.SandboxRegionCode);
            String? refreshToken = Environment.GetEnvironmentVariable(Constants.RefreshTokenKeyName);

            /// Call Solicitations API to create produce review and feedback
            SolicitationsApi solicitationsApi = ApiUtils.GetSolicitationsApi(regionCode, refreshToken);
            CreateProductReviewAndSellerFeedbackSolicitationResponse submitSolicitationsResponse = solicitationsApi.CreateProductReviewAndSellerFeedbackSolicitation(amazonOrderId, new List<String> { marketplaceId });

            // If response is not null, validate response
            if (submitSolicitationsResponse != null)
            {
                logger.LogLine("Result: " + JsonConvert.SerializeObject(submitSolicitationsResponse));
                var errors = submitSolicitationsResponse.Errors;
                // If no errors, the solicitation was successfully created
                if (errors==null|| errors.Count==0)
                {
                    logger.LogLine("Solicitation successfully created");
                }
                else
                {
                    logger.LogLine("Result errors" + submitSolicitationsResponse.ToJson());
                }
                return
                   submitSolicitationsResponse.ToJson();
            }
            
            else
            {
                logger.LogLine("Error while calling CreateProductReviewAndSellerFeedbackSolicitation");
            }
            return String.Empty;

        }

    }

}




