using Amazon.Lambda.Core;
using Amazon.SellingPartnerAPIAA;
using Amazon.Lambda;
using spApiCsharpApp;
using Newtonsoft.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.SimpleNotificationService;
using Amazon.SimpleNotificationService.Model;
using System.Linq;
using System.Threading.Tasks;
using spApiCsharpApp.swaggerClient.Api;
using System.Linq.Expressions;
using System.Collections;
using spApiCsharpApp.swaggerClient.Model.DirectFulfillmentShipping;
using spApiCsharpApp.swaggerClient.Model.DirectFulfillmentTransactions;
using spApiCsharpApp.swaggerClient.Model.Tokens;
using Amazon;
using RestSharp;
using System.Net.Mail;
using System.Reflection.Metadata;

namespace spApiCsharpApp
{
    public class getShippingLabel
    {            
        private static String DFOrdersTableName = System.Environment.GetEnvironmentVariable(Constants.ORDERS_TABLE_NAME_ENV_VARIABLE);     
        private static String NotificationSNSTopicARN = System.Environment.GetEnvironmentVariable(Constants.SNS_TOPIC_ARN_ENV_VARIABLE);
        private static String s3BucketName = System.Environment.GetEnvironmentVariable(Constants.LABELS_S3_BUCKET_NAME_ENV_VARIABLE);

        public string getShippingLabelHandler(DFOrderInput input, ILambdaContext context)
        {
            LambdaLogger.Log("Get ShippingLabel Lambda input: " + JsonConvert.SerializeObject(input));
            String regionCode = input.regionCode;            
            String presignedUrl = String.Empty;

            try
            {
                string orderId = input.dfOrder.orderId.ToString();

                //Update Order status to ACKNOWLEDGED in Orders DynamoDB
                UpdateOrder(DFOrdersTableName, orderId, "orderStatus", Constants.ACKNOWLEDGED_ORDER_STATUS);
                LambdaLogger.Log("Order Status updated to " + Constants.ACKNOWLEDGED_ORDER_STATUS + " in " + DFOrdersTableName + " DynamoDB table for Order: " + orderId);

                VendorShippingLabelsApi vendorShippingLabelsApi = ApiUtils.getVendorShippingLabelApi(regionCode);

                PartyIdentification sellingPartyId = new PartyIdentification(input.dfOrder.sellingPartyId.ToString());
                PartyIdentification shipFromPartyId = new PartyIdentification(input.dfOrder.shipFromPartyId.ToString());
                CreateShippingLabelsRequest createShippingLabelsRequest = new CreateShippingLabelsRequest(sellingPartyId, shipFromPartyId);
                String createShippingLabelsRequestJSONBody = JsonConvert.SerializeObject(createShippingLabelsRequest);                

                var localVarPathParams = new Dictionary<String, String>();
                localVarPathParams.Add("orderNumber", orderId);

                IRestResponse shippingLabelResponse = (IRestResponse)ApiUtils.buildAndExecuteRestrictedRequest(regionCode, Constants.SHIP_LABEL_API_RESTRICTED_RESOURCE_PATH, RestSharp.Method.POST, createShippingLabelsRequestJSONBody, localVarPathParams);

                if (shippingLabelResponse.StatusCode == System.Net.HttpStatusCode.OK)
                {
                    ShippingLabel shippingLabel = (ShippingLabel)JsonConvert.DeserializeObject(shippingLabelResponse.Content, typeof(ShippingLabel));

                    //---START---Store the label in S3 and generate a presignedURL --> Has to be looped based on the number of labels returned
                    AWSConfigsS3.UseSignatureVersion4 = true;
                    AmazonS3Client s3Client = new AmazonS3Client();

                    List<String> trackingNumbersList = new List<String>();
                    List<String> shipMethodsList = new List<String>();
                    List<String> preSignedUrlList = new List<String>();

                    //Store each of the labels returned by the API for the Order in S3 and generate pre-signed URL
                    foreach (LabelData labelData in shippingLabel.LabelData)
                    {
                        trackingNumbersList.Add(labelData.TrackingNumber);
                        shipMethodsList.Add(labelData.ShipMethod);

                        //Store the label in S3 bucket
                        String objectKey = orderId + Guid.NewGuid();
                        byte[] decodedLabelContent = decodeLabelContent(labelData.Content);
                        MemoryStream labelContentMS = new MemoryStream(decodedLabelContent);
                        storeLabelAsync(s3Client, s3BucketName, objectKey, labelContentMS);
                        LambdaLogger.Log("Label successfully stored in S3 bucket: " + s3BucketName + " for Order: " + orderId);

                        //Generate presigned URL and add it to preSignedUrlList            
                        presignedUrl = generatePreSignedURL(s3Client, s3BucketName, objectKey, 1);
                        preSignedUrlList.Add(presignedUrl);
                        LambdaLogger.Log("Presigned URL successfully generated for Shipping label for Order: " + orderId);
                    }

                    //---END---Store the label in S3 and return a presignedURL

                    //Update the Shipping Information for the order in Orders Dynamo DB table
                    String actualShipMethods = String.Join(",", shipMethodsList);
                    String trackingNumbers = String.Join(",", trackingNumbersList);
                    String preSignedUrlLabels = String.Join("     ,     ", preSignedUrlList);

                    if ((UpdateOrder(DFOrdersTableName, orderId, "actualShipMethod", actualShipMethods)) 
                        && (UpdateOrder(DFOrdersTableName, orderId, "trackingNumber", trackingNumbers))
                        && (UpdateOrder(DFOrdersTableName, orderId, "labelPreSignedURL", preSignedUrlLabels)))
                    {
                        LambdaLogger.Log("DFOrders Dynamo DB updated with shipping information for Order ID: " + orderId);
                    }

                    //-----START---Publish message to SNSTopic
                    String emailMessage = "Link to download the Shipping Labels for Order Number: " + orderId + " is: " + preSignedUrlLabels;
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
                    LambdaLogger.Log("Shipping Label was not generated, Shipping Label API call error response: " + shippingLabelResponse.StatusCode);
                }

            }

            catch (Exception ex)
            {
                throw new Exception("Calling Vendor Shipping Label APIs failed", ex);
            }

            return presignedUrl;
        }
               
        //Function to call the async function to Update an Order in DFOrders DynamoDB table
        private bool UpdateOrder(String DBTableName, String orderNumber, String attributeName, String attributeValue)
        {
            Task<bool> task = Task.Run<bool>(async () => await UpdateOrderAsync(DBTableName, orderNumber, attributeName, attributeValue));
            return task.Result;
        }

        //Asynchronous function to Update an Order in DFOrders DynamoDB table
        private async Task<bool> UpdateOrderAsync(String DBTableName, String orderNumber, String attributeName, String attributeValue)
        {
            AmazonDynamoDBClient dynmamoDBclient = new AmazonDynamoDBClient();
            
            var request = new UpdateItemRequest
            {
                TableName = DBTableName,
                Key = new Dictionary<string, AttributeValue>() { { "orderNumber", new AttributeValue { S = orderNumber } } },
                ExpressionAttributeNames = new Dictionary<string, string>()
                {
                    {"#A", attributeName}
                },
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>()
                {
                    {":ack",new AttributeValue { S = attributeValue}}
                },

                UpdateExpression = "SET #A = :ack"
            };
            var response = await dynmamoDBclient.UpdateItemAsync(request);
            return true;
        }

        private byte[] decodeLabelContent(String LabelContent)
        {
            String Base64LabelContent = LabelContent;
            byte[] labelContentDecocded = Convert.FromBase64String(Base64LabelContent);
            return labelContentDecocded;

        }

        private async void storeLabelAsync(AmazonS3Client client, String s3BucketName, String objectKey, MemoryStream label)
        {
            PutObjectRequest putObjectRequest = new PutObjectRequest { BucketName = s3BucketName, Key = objectKey, ContentType = "image/png", InputStream = label };
            await client.PutObjectAsync(putObjectRequest);
        }

        public static string generatePreSignedURL(AmazonS3Client client, string bucketName, string objectKey, double duration)
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = bucketName,
                Key = objectKey,
                Verb = HttpVerb.GET,
                Expires = DateTime.UtcNow.AddHours(duration),
            };

            string url = client.GetPreSignedURL(request);
            return url;
        }

        //Function to call the async function to send an email notification with shipping label presigned URL
        private String PublishToSNSTopic(String topicArn, String emailMessage)
        {
            Task<string> task = Task.Run<string>(async () => await PublishToSNSTopicAsync(topicArn, emailMessage));
            return task.Result;
        }

        //Async function to send an email notification with shipping label presigned URL
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

