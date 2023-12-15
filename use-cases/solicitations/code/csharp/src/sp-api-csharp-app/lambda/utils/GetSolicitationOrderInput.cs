using System;
using System.Runtime.Serialization;
using System.Xml.Linq;
using Newtonsoft.Json;

namespace SpApiCsharpApp.lambda.utils
{
    public class GetSolicitationOrderInput
    {
        public string OrderId { get; set; }

        public string MarketplaceId { get; set; }

        public string ScheduleName { get; set; }

        public DateTime LatestSolicitationRequestDate { get; set; }
    }
	
}

