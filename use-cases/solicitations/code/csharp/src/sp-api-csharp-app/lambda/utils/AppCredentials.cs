using System;
using Newtonsoft.Json;

namespace SpApiCsharpApp
{
    public class AppCredentials
    {
        [JsonProperty("AppClientId")]
        public String clientId;

        [JsonProperty("AppClientSecret")]
        public String clientSecret;

    }
}
