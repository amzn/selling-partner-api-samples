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
using Amazon.SQS;
using SpApiCsharpApp.swaggerClient.Model.Notifications;
using System.ComponentModel;
using SpApiCsharpApp.swaggerClient.Client;
using SpApiCsharpApp.lambda.utils;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
//[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]
namespace SpApiCsharpApp
{
    public class SubscribeNotificationsHandler
    {
        private static String NotificationTypeKeyName = "NotificationType";
        private static String RegionCodeKeyName = "RegionCode";
        private static String ScheduleKeyName = "ScheduleName";

        /* Sample event input
        {
            "NotificationType": "ORDER_CHANGE",
            "RegionCode": "NA",
            "RefreshToken": "Atzr|IwEBIFdeNQT9QH3..."
        }
        */
        public string FunctionHandler(SubscribeNotificationsInput input, ILambdaContext context)
        {
            ILambdaLogger logger = context.Logger;
            logger.LogLine("Subscribe Notifications handler started");
            logger.LogLine(JsonConvert.SerializeObject(input));

            // Retrieve request details from input payload
            var notificationType = input.NotificationType;
            var regionCode = input.RegionCode;
            var refreshToken =input.RefreshToken;

            // Create destination if it doesn't exist
            string destinationId;
            try
            {
                destinationId = CreateDestination(regionCode, refreshToken);
                logger.LogLine($"Destination created - Destination Id: {destinationId}");
            }
            catch (Exception e)
            {
                throw new Exception("Create destination failed", e);
            }

            // Create subscription if it doesnt exist
            string subscriptionId;
            try
            {
                subscriptionId = CreateSubscription(regionCode, refreshToken, notificationType, destinationId);
                logger.LogLine($"Subscription created - Subscription Id: {subscriptionId}");

                return $"Destination Id: {destinationId} - Subscription Id: {subscriptionId}";
            }
            catch (Exception e)
            {
                throw new Exception("Create subscription failed", e);
            }

        }

        private String? CreateDestination(string regionCode, string refreshToken)
        {
            // Get SQS queue ARN from environment variable
             var sqsQueueArn = Environment.GetEnvironmentVariable(Constants.SqsQueueArnEnvVariable);

            // Create request parameters for "CreateDestination" API call
            var sqsResource = new SqsResource (sqsQueueArn);
            var resourceSpec = new DestinationResourceSpecification (sqsResource);

            var request = new CreateDestinationRequest(
            
                name:Guid.NewGuid().ToString(),
                resourceSpecification: resourceSpec
            );

            //Invoke the Notifications API using a grantless notifications scope
            NotificationsApi notificationsApi = ApiUtils.GetNotificationsApi(regionCode, refreshToken, Constants.LwaNotificationsScope);

            var destinationId = "";
            try
            {
                CreateDestinationResponse response = notificationsApi.CreateDestination(request); 
                destinationId = response.Payload.DestinationId;
            }
            catch (ApiException e)
            {
                // If destination exists, retrieve ID
                if (e!=null && e.ErrorCode==409)
                {
                    var destinations = notificationsApi.GetDestinations();

                    var sqsDestination = destinations!=null?destinations.Payload.FirstOrDefault(d => d.Resource.Sqs != null
                            && sqsQueueArn == d.Resource.Sqs.Arn):null;

                    if (sqsDestination != null)
                    {
                        destinationId = sqsDestination.DestinationId;
                    }
                }
                else
                {
                    throw;
                }
            }

            return destinationId ;
        }

        private String? CreateSubscription(string regionCode, string refreshToken, string notificationType, string destinationId)
        {
            // Create request parameters for "CreateSubscription" API call
            var request = new CreateSubscriptionRequest(
                destinationId: destinationId,
                payloadVersion: "1.0",
                processingDirective: new ProcessingDirective(new EventFilter(eventFilterType: EventFilter.EventFilterTypeEnum.ORDERCHANGE))
            ) ;

            // Call Notifications API using refresh token
            NotificationsApi notificationsApi = ApiUtils.GetNotificationsApi(regionCode, refreshToken);

            try
            {
                CreateSubscriptionResponse response = notificationsApi.CreateSubscription(request, notificationType);
                return response.Payload.SubscriptionId;
            }
            catch (ApiException e)
            {
                // If subscription exists, retrieve ID
                if (e != null && e.ErrorCode == 409)                   
                {
                    var response = notificationsApi.GetSubscription(notificationType);
                    return response.Payload.SubscriptionId;
                }
                else
                {
                    throw;
                }
            }
        }

    }

}




