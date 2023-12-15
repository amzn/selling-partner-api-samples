using System;
using System.Runtime.Serialization;
using System.Xml.Linq;

namespace SpApiCsharpApp.lambda.utils
{
    public class SubscribeNotificationsInput
	{
        public string NotificationType { get; set; }

        public string RegionCode { get; set; }

        public string RefreshToken { get; set; }
    }
}

