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
using System.Linq.Expressions;
using System.Collections;
using spApiCsharpApp.swaggerClient.Model.DirectFulfillmentShipping;
using spApiCsharpApp.swaggerClient.Model.DirectFulfillmentTransactions;
using spApiCsharpApp.swaggerClient.Model.Tokens;
using Amazon;


namespace spApiCsharpApp
{
    public class shipmentConfirmDFOrder
    {
       
        public string shipmentConfirmDFOrderHandler(DFOrderInput input, ILambdaContext context)
        {
            LambdaLogger.Log("Shipment Confirmation DF Order Lambda input: " + JsonConvert.SerializeObject(input));

            String regionCode = input.regionCode;                        
            String shipConfirmTransactionId = String.Empty;

            try
            {
                string orderId = input.dfOrder.orderId; //Get the Order Number from input to Lambda

                VendorShippingApi vendorShippingApi = ApiUtils.getVendorShippingApi(regionCode);

                ShipmentDetails shipmentDetails = new ShipmentDetails(DateTime.Now, ShipmentDetails.ShipmentStatusEnum.SHIPPED);
                PartyIdentification sellingPartyId = new PartyIdentification(input.dfOrder.sellingPartyId.ToString());
                PartyIdentification shipFromPartyId = new PartyIdentification(input.dfOrder.shipFromPartyId.ToString());

                List<Item> shippedItems = new List<Item>();
                foreach (DFOrderItems orderItem in input.dfOrder.items)
                {
                    int itemSequenceNumber = Int32.Parse(orderItem.itemSequenceNumber);
                    Item item = new Item(itemSequenceNumber, orderItem.buyerProductIdentifier, orderItem.vendorProductIdentifier, new ItemQuantity(orderItem.quantity, "Each"));
                    shippedItems.Add(item);
                }

                ShipmentConfirmation shipmentConfirmation = new ShipmentConfirmation(orderId, shipmentDetails, sellingPartyId, shipFromPartyId, shippedItems);
                List<ShipmentConfirmation> shipmentConfirmationsList = new List<ShipmentConfirmation> { shipmentConfirmation };

                SubmitShipmentConfirmationsRequest submitShipmentConfirm = new SubmitShipmentConfirmationsRequest(shipmentConfirmationsList);

                TransactionReference transactionReference = vendorShippingApi.SubmitShipmentConfirmations(submitShipmentConfirm);
                LambdaLogger.Log("SubmitShipmentConfirmation API response TransactionId for Order: " + orderId + " is: " + transactionReference.TransactionId.ToString());

                shipConfirmTransactionId = transactionReference.TransactionId.ToString();                

            }

            catch (Exception ex)
            {
                throw new Exception("Calling Vendor Shipment Confirmation APIs failed", ex);
            }

            return shipConfirmTransactionId;
        }
         
    }
}

