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


namespace spApiCsharpApp
{
    public class checkTransactionStatus
    {       
        public string checkTransactionStatusHandler(DFOrderInput input, ILambdaContext context)
        {
            LambdaLogger.Log("Check Transaction Status Lambda input: " + JsonConvert.SerializeObject(input));
            String regionCode = input.regionCode;            
            String transactionStatus = String.Empty;

            try
            {
                string orderId = input.dfOrder.orderId.ToString();
                string transactionId = String.Empty;                

                //Get Order Acknowledgement transaction Id                                  
                transactionId = input.dfOrder.ackTransactionStatus.transactionId.ToString();                                       
                
                VendorTransactionApi vendorTransactionApi = ApiUtils.getVendorTransactionApi(regionCode);
                GetTransactionResponse transactionStatusResponse = vendorTransactionApi.GetTransactionStatus(transactionId);
                transactionStatus = transactionStatusResponse.Payload._TransactionStatus.Status.ToString();

                LambdaLogger.Log("Transaction Status Response for Order Acknowledgment is : " + transactionStatus + " for order: " + orderId);
            }

            catch (Exception ex)
            {
                throw new Exception("Calling Vendor Transaction Status APIs failed", ex);
            }

            return transactionStatus;
        }            
    }
}

