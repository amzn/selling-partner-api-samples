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
using Newtonsoft.Json.Linq;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using Amazon;
using System.Text.Json;
using Amazon.Lambda.SQSEvents;
using SpApiCsharpApp.lambda.utils;

// Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
//[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]
namespace SpApiCsharpApp
{
    public class SolicitationSchedulerHandler
    {
        private static String MarketplaceIdKeyName = "MarketplaceId";
        private static String OrderKeyName = "OrderId";

        /* Sample event input
        {
            "Records": [
                "body": {
                    "NotificationType": "ORDER_CHANGE",
                    "Payload": {
                        "OrderChangeNotification": {
                            "SellerId": "A3TH9S8BH6GOGM",
                            "AmazonOrderId": "123-1234567-1234567",
                            "Summary": {
                                "MarketplaceId": "ATVPDKIKX0DER",
                                "OrderStatus": "Shipped",
                                "EarliestDeliveryDate": "2023-10-10T13:30:00.000Z",
                                "LatestDeliveryDate": "2023-10-20T13:30:00.000Z"
                            }
                        }
                    }
                }
            ]
        }
        */
        public async Task<object> FunctionHandlerAsync(SQSEvent input, ILambdaContext context)
        {
            // Logging
            context.Logger.LogLine("Solicitation Scheduler handler started");
            context.Logger.LogLine("Input: " + JsonConvert.SerializeObject(input));

            // Process all notifications
           
                foreach (var record in input.Records)
                {
                    var body = record.Body;
                    var notificationBody = JsonConvert.DeserializeObject<SPAPINotification>(body);

                    // If not ORDER_CHANGE notification, skip
                    if (notificationBody.NotificationType != Constants.NotificationTypeOrderChange)
                    {
                        context.Logger.LogLine($"Notification type {notificationBody.NotificationType} skipped");
                        continue;
                    }

                    var orderChangeNotification = notificationBody.Payload.OrderChangeNotification;

                    // If status is not Shipped, skip
                    if (orderChangeNotification.Summary.OrderStatus != Constants.OrderChangeNotificationStatusShipped)
                    {
                        context.Logger.LogLine($"Notification status {orderChangeNotification.Summary.OrderStatus} skipped");
                        continue;
                    }

                    // Get order details
                    var sellerId = orderChangeNotification.SellerId;
                    var orderId = orderChangeNotification.AmazonOrderId;
                    var marketplaceId = orderChangeNotification.Summary.MarketplaceId;
                    var orderEarliestDeliveryDate = orderChangeNotification.Summary.EarliestDeliveryDate;
                    var orderLatestDeliveryDate = orderChangeNotification.Summary.LatestDeliveryDate;

                    // Create schedule name
                    var scheduleName = $"solicitations-{sellerId}-{orderId}";

                    // Check if schedule exists
                    var scheduler = new AmazonSchedulerClient();
                    try
                    {
                        var getScheduleRequest = new GetScheduleRequest { Name = scheduleName };
                        var schedule = await scheduler.GetScheduleAsync(getScheduleRequest);
                        context.Logger.LogLine($"Schedule with name = {scheduleName} already exists. Skipping notification.");
                        continue;
                    }
                    catch (Amazon.Scheduler.Model.ResourceNotFoundException e)
                    {
                        context.Logger.LogLine($"Schedule with name = {scheduleName} doesn't exist. Proceeding to create it.");
                    }

                    // Calculate schedule date
                    var scheduleDateTime = DateTime.Parse(orderEarliestDeliveryDate).AddDays(5);
                    var scheduleDateTimeStr = scheduleDateTime.ToString("s");
                    var scheduleExpression = $"at({scheduleDateTimeStr})";
                    context.Logger.LogLine($"Schedule Expression = {scheduleExpression}");

                    // Calculate latest solicitation request date 
                    var latestSolicitationRequestDateTime = DateTime.Parse(orderLatestDeliveryDate).AddDays(30);
                    var latestSolicitationRequestDateStr = latestSolicitationRequestDateTime.ToString("s");
                    context.Logger.LogLine($"Solicitation date = {latestSolicitationRequestDateStr}");

                    // Get Step Function details
                    var stateMachineArn = Environment.GetEnvironmentVariable(Constants.SolicitationsStateMachineArnEnvVariable);
                    var roleArn = Environment.GetEnvironmentVariable(Constants.SolicitationsSchedulerRoleArnEnvVariable);

                    // Input for state machine
                    var inputPayload = new Dictionary<string, string> {
                        { "OrderId", orderId },
                        { "MarketplaceId", marketplaceId },
                        { "LatestSolicitationRequestDate", latestSolicitationRequestDateStr },
                        { "ScheduleName", scheduleName }
                    };

                    // Template for EventBridge schedule
                    var sfnTemplated = new Amazon.Scheduler.Model.Target
                    {
                        Arn = stateMachineArn,
                        RoleArn = roleArn,
                        Input = JsonConvert.SerializeObject(inputPayload)
                    };

                    var flexWindow = new FlexibleTimeWindow
                    {
                        Mode = "FLEXIBLE",
                        MaximumWindowInMinutes = 1
                    };

                    context.Logger.LogLine($"Input payload = {JsonConvert.SerializeObject(inputPayload)}");

                    // Create EventBridge schedule
                    var createScheduleRequest = new CreateScheduleRequest
                    {
                        Name = scheduleName,
                        ScheduleExpression = scheduleExpression,
                        Target = sfnTemplated,
                        FlexibleTimeWindow = flexWindow
                    };
                    var response = await scheduler.CreateScheduleAsync(createScheduleRequest);

                    var scheduleArn = response.ScheduleArn;
                    context.Logger.LogLine($"Created schedule with arn = {scheduleArn}");
                }
            
            return "success";
        }

    }
}




