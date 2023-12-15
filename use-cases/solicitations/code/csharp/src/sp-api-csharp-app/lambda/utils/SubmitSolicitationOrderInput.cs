using System;
using System.Runtime.Serialization;
using System.Xml.Linq;

namespace SpApiCsharpApp.lambda.utils
{
    public class SubmitSolicitationOrderInput
    {
        public string OrderId { get; set; }

        public string MarketplaceId { get; set; }

        public string ScheduleName { get; set; }

        public DateTime LatestSolicitationRequestDate { get; set; }

        public GetSolicitationActions GetSolicitationActions { get; set; }
    }
	
}

