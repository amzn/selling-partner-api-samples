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
using System.Linq.Expressions;
using System.Collections;


namespace spApiCsharpApp
{
    public class acknowledgeDFOrders
    {                 

        public string acknowledgeDFOrdersHandler(DFOrderInput input, ILambdaContext context)
        {
            LambdaLogger.Log("Acknowledge DF Order Lambda input: " + JsonConvert.SerializeObject(input));

            String regionCode = input.regionCode;                    
            String acknowledgementTransactionID = String.Empty;

            try
            {
                string orderId = input.dfOrder.orderId; //Get the Order Number from input to Lambda

                AcknowledgementStatus acknowledgementStatus = new AcknowledgementStatus(Constants.ORDER_ACKNOWLEDGEMENT_CODE, Constants.ORDER_ACKNOWLEDGEMENT_DESCRIPTION); //Acknowledgement code is a unique two digit value which indicates the status of the acknowledgement and description is the reason for the acknowledgement code
                PartyIdentification sellingPartyId = new PartyIdentification(input.dfOrder.sellingPartyId.ToString());
                PartyIdentification shipFromPartyId = new PartyIdentification(input.dfOrder.shipFromPartyId.ToString());

                List<OrderItemAcknowledgement> orderItemAcknowledgementList = new List<OrderItemAcknowledgement>();

                foreach (DFOrderItems orderItem in input.dfOrder.items)
                {
                    ItemQuantity acknowledgedQuantity = new ItemQuantity(orderItem.quantity, ItemQuantity.UnitOfMeasureEnum.Each);
                    OrderItemAcknowledgement orderAckItem = new OrderItemAcknowledgement(orderItem.itemSequenceNumber, orderItem.buyerProductIdentifier, orderItem.vendorProductIdentifier, acknowledgedQuantity);

                    orderItemAcknowledgementList.Add(orderAckItem);
                }

                OrderAcknowledgementItem orderAcknowledgementItem = new OrderAcknowledgementItem(orderId, orderId, DateTime.Now, acknowledgementStatus, sellingPartyId, shipFromPartyId, orderItemAcknowledgementList);

                List<OrderAcknowledgementItem> orderAcknowledgementList = new List<OrderAcknowledgementItem>();
                orderAcknowledgementList.Add(orderAcknowledgementItem);

                VendorOrdersApi vendorOrderApi = ApiUtils.getVendorOrdersApi(regionCode);
                SubmitAcknowledgementRequest submitAcknowledgementRequest = new SubmitAcknowledgementRequest(orderAcknowledgementList);
                string orderAcknowledgemntJSON = JsonConvert.SerializeObject(submitAcknowledgementRequest);

                SubmitAcknowledgementResponse submitAcknowledgementResponse = vendorOrderApi.SubmitAcknowledgement(submitAcknowledgementRequest);
                acknowledgementTransactionID = submitAcknowledgementResponse.Payload._TransactionId.ToString();

                LambdaLogger.Log("Order Acknowledgement Transaction Id is: " + acknowledgementTransactionID + " for Order Number: " + orderId);
            }

            catch (Exception ex)
            {
                throw new Exception("Calling Vendor Order Acknowldegment APIs failed", ex);
            }

            return acknowledgementTransactionID;
        }
    }
}

