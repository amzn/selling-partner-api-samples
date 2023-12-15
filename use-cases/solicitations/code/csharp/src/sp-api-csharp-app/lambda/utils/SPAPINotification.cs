using System;
namespace SpApiCsharpApp.lambda.utils
{
    public class SPAPINotification
    {
        public String NotificationType { get; set; }

        public DateTime EventTime { get; set; }

        public NotificationPayload Payload { get; set; }

    }
}

