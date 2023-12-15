using System;
namespace SpApiCsharpApp
{
    public class RegionConfig
    {
        public String awsRegion;

        public String spApiEndpoint;

        public RegionConfig(String awsRegion, String spApiEndpoint)
        {
            this.awsRegion = awsRegion;
            this.spApiEndpoint = spApiEndpoint;
        }

    }
}

