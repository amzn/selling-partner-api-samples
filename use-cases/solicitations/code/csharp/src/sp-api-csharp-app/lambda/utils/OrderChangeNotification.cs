namespace SpApiCsharpApp.lambda.utils
{
    public class OrderChangeNotification
    {
        public String NotificationLevel { get; set; }

        public String SellerId { get; set; }

        public String AmazonOrderId { get; set; }

        public NotificationOrderSummary Summary { get; set; }
    }
}