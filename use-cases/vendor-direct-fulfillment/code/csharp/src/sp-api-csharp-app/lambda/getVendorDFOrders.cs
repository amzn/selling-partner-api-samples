using Amazon.Lambda.Core;
using Amazon.SellingPartnerAPIAA;
using Amazon.Lambda;
using spApiCsharpApp;
using Newtonsoft.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Amazon.SimpleNotificationService;
using Amazon.SimpleNotificationService.Model;
using System.Linq;
using System.Threading.Tasks;
using spApiCsharpApp.swaggerClient.Api;
using spApiCsharpApp.swaggerClient.Model.DirectFulfillmentOrders;
using System;
using Amazon.S3.Model;

//Assembly attribute to enable the Lambda function's JSON input to be converted into a .NET class.
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace spApiCsharpApp
{
    public class getVendorDFOrders
    {        
        private static String DFOrdersTableName = System.Environment.GetEnvironmentVariable(Constants.ORDERS_TABLE_NAME_ENV_VARIABLE);
        private static String DFOrderItemsTableName = System.Environment.GetEnvironmentVariable(Constants.ORDER_ITEMS_TABLE_NAME_ENV_VARIABLE);
        private static String NotificationSNSTopicARN = System.Environment.GetEnvironmentVariable(Constants.SNS_TOPIC_ARN_ENV_VARIABLE);

        public GetDFOrdersOutput getDFOrdersHandler(DFOrderInput input, ILambdaContext context)
        {            
            LambdaLogger.Log("Get Vendor DF Orders Lambda Input: " + JsonConvert.SerializeObject(input));
            String regionCode = input.regionCode;

            GetDFOrdersOutput dFLambdaOutput = new GetDFOrdersOutput();

            DateTime createdAfterDate = DateTime.Now.AddHours(-24);  //To get orders for the last 24 hours
            DateTime createdBeforeDate = DateTime.Now;
            String orderStatus = Constants.NEW_ORDER_STATUS;
            String emailMessage = "List of DF Orders to be fulfilled: ";
            int limit = Int32.Parse(input.limit);  //limit is passed as input string to the function to set the maximum number of orders to fetch using the GetOrders API
            try
            {
                //-----START-----Get DF Orders through Get Orders API 
                VendorOrdersApi vendorOrderApi = ApiUtils.getVendorOrdersApi(regionCode);
                GetOrdersResponse getOrdersResponse = new GetOrdersResponse();
                
                //If any limit is set in the input to this lambda function, then the limit is added as parameter to the GetOrders API call
                if (limit > 0)
                {
                    getOrdersResponse = vendorOrderApi.GetOrders(createdAfterDate, createdBeforeDate, null, orderStatus, limit, null, null, null);
                }
                else
                {
                    getOrdersResponse = vendorOrderApi.GetOrders(createdAfterDate, createdBeforeDate, null, orderStatus, null, null, null, null);
                }

                if (getOrdersResponse.Payload.Orders.Count >= 1)
                {
                    OrderList orderList = getOrdersResponse.Payload;
                    List<DFOrder> dFOrdersList = new List<DFOrder>();
                    foreach (Order order in orderList.Orders)
                    {
                        if (PutOrder(DFOrdersTableName, order) == true)
                        {
                            LambdaLogger.Log("Purchase Order Number: " + order.PurchaseOrderNumber.ToString() + " is put in Orders DynamoDB");
                            emailMessage += order.PurchaseOrderNumber.ToString() + ", ";
                            DFOrder dFOrder = new DFOrder();
                            dFOrder.orderId = order.PurchaseOrderNumber.ToString();
                            dFOrder.orderDate = order.OrderDetails.OrderDate.ToString();
                            dFOrder.sellingPartyId = order.OrderDetails.SellingParty.PartyId.ToString();
                            dFOrder.shipFromPartyId = order.OrderDetails.ShipFromParty.PartyId.ToString();
                            dFOrder.shipMethod = order.OrderDetails.ShipmentDetails.ShipMethod.ToString();                            
                            dFOrder.orderStatus = Constants.ASSIGNED_ORDER_STATUS;

                            List<DFOrderItems> dfOrderItemsList = new List<DFOrderItems>();

                            foreach (OrderItem orderItem in order.OrderDetails.Items)
                            {
                                //Put in OrderItems DynamoDB table
                                if (PutOrderItems(DFOrderItemsTableName, orderItem, order.PurchaseOrderNumber.ToString()) == true)
                                {
                                    LambdaLogger.Log("Order Item ASIN  " + orderItem.BuyerProductIdentifier.ToString() + " is put in OrderItems DynamoDB");
                                    DFOrderItems dfOrderItems = new DFOrderItems();
                                    dfOrderItems.itemSequenceNumber = orderItem.ItemSequenceNumber;
                                    dfOrderItems.buyerProductIdentifier = orderItem.BuyerProductIdentifier;
                                    dfOrderItems.vendorProductIdentifier = orderItem.VendorProductIdentifier;
                                    dfOrderItems.quantity = (int)orderItem.OrderedQuantity.Amount;
                                    dfOrderItemsList.Add(dfOrderItems);
                                }
                                else
                                {
                                    LambdaLogger.Log("Order Item ASIN  " + orderItem.BuyerProductIdentifier.ToString() + " is NOT put in OrderItems DynamoDB");
                                }
                            }
                            dFOrder.items = dfOrderItemsList;
                            dFOrdersList.Add(dFOrder);
                        }
                        else
                        {
                            LambdaLogger.Log("Purchase Order Number: " + order.PurchaseOrderNumber.ToString() + " is NOT put in DynamoDB");
                        }
                    }
                    dFLambdaOutput.dfOrdersList = dFOrdersList;

                    //Publish message to SNSTopic         
                    String messageId = PublishToSNSTopic(NotificationSNSTopicARN, emailMessage);

                    if (messageId != null)
                    {
                        LambdaLogger.Log("Message with messageId: " + messageId + " published sucessfully to SNS Topic");
                    }
                    else
                    {
                        LambdaLogger.Log("Message was not published sucessfully to SNS Topic");
                    }
                }
                else
                {
                    LambdaLogger.Log("No New DF Orders are available to be processed now!");
                    List<DFOrder> dFOrdersList = new List<DFOrder>();
                    dFLambdaOutput.dfOrdersList = dFOrdersList;
                }
              
            }
            catch (Exception ex)
            {
                throw new Exception("Calling Vendor Orders API failed", ex);
            }

            return dFLambdaOutput;
        }

        //Indiviudal functions
        private bool PutOrder(String DBTableName, Order order)
        {
            Task<bool> task = Task.Run<bool>(async () => await PutOrderAsync(DBTableName, order));
            return task.Result;
        }

        //Asynchronous function to put Order in DFOrders DynamoDB table
        private async Task<bool> PutOrderAsync(String DBTableName, Order order)
        {
            //Iterate through all the orders and insert in DynamoDB orders table
            AmazonDynamoDBClient dynmamoDBclient = new AmazonDynamoDBClient();            

            var request = new PutItemRequest
            {
                TableName = DBTableName,
                Item = new Dictionary<string, AttributeValue>
                {
                    { "orderNumber", new AttributeValue { S = order.PurchaseOrderNumber.ToString() }},
                    { "orderDate", new AttributeValue { S = order.OrderDetails.OrderDate.ToString() }},
                    { "orderStatus", new AttributeValue { S = "ASSIGNED" }},
                    { "sellingPartyId", new AttributeValue { S = order.OrderDetails.SellingParty.PartyId.ToString()}},
                    { "shipFromPartyId", new AttributeValue { S = order.OrderDetails.ShipFromParty.PartyId.ToString() }},
                    { "shipMethod", new AttributeValue { S = order.OrderDetails.ShipmentDetails.ShipMethod.ToString() }}
                }

            };
            var response = await dynmamoDBclient.PutItemAsync(request);
            return response.HttpStatusCode == System.Net.HttpStatusCode.OK;
        }

        //Function to call the async function to put Order Items in DFOrdersItems DynamoDB Table
        private bool PutOrderItems(String DBTableName, OrderItem orderItem, String orderNumber)
        {
            Task<bool> task = Task.Run<bool>(async () => await PutOrderItemsAsync(DBTableName, orderItem, orderNumber));
            return task.Result;
        }

        //Async function to put Order in DFOrders DynamoDB table
        private async Task<bool> PutOrderItemsAsync(String DBTableName, OrderItem orderItem, String orderNumber)
        {
            AmazonDynamoDBClient dynmamoDBclient = new AmazonDynamoDBClient();
            
            var request = new PutItemRequest
            {
                TableName = DBTableName,
                Item = new Dictionary<string, AttributeValue>
                {
                    { "itemASIN", new AttributeValue { S = orderItem.BuyerProductIdentifier}},
                    { "orderNumber", new AttributeValue { S = orderNumber }},
                    { "vendorProductIdentifier", new AttributeValue { S = orderItem.VendorProductIdentifier}},
                    { "itemSequenceNumber", new AttributeValue { S = orderItem.ItemSequenceNumber }},
                    { "quantityOrdered", new AttributeValue { S = orderItem.OrderedQuantity.Amount.ToString()}}
                }

            };
            var response = await dynmamoDBclient.PutItemAsync(request);
            return response.HttpStatusCode == System.Net.HttpStatusCode.OK;
        }

        //Function to call the async function to send an email notification with list of DF Orders to fulfill
        private String PublishToSNSTopic(String topicArn, String emailMessage)
        {
            Task<string> task = Task.Run<string>(async () => await PublishToSNSTopicAsync(topicArn, emailMessage));
            return task.Result;
        }
        
        /// <summary>
        /// Async function that publishes a message to an Amazon SNS topic.
        /// </summary>    
        /// <param name="topicArn">The ARN of the topic.</param>
        /// <param name="messageText">The text of the message.</param>
        public static async Task<String> PublishToSNSTopicAsync(string topicArn, string messageText)
        {
            IAmazonSimpleNotificationService snsClient = new AmazonSimpleNotificationServiceClient();
            var request = new PublishRequest
            {
                TopicArn = topicArn,
                Message = messageText,
            };

            var response = await snsClient.PublishAsync(request);

            return response.MessageId;            
        }      
    }
}

