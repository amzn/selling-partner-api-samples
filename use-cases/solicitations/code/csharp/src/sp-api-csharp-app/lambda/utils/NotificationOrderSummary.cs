namespace SpApiCsharpApp.lambda.utils
{
    public class NotificationOrderSummary
    {       
        public String OrderStatus { get; set; }

        public String FulfillmentType { get; set; }

        public String MarketplaceId { get; set; }

        public String EarliestDeliveryDate { get; set; }

        public String LatestDeliveryDate { get; set; }



    }
}