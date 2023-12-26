using System;
using Newtonsoft.Json;

namespace spApiCsharpApp
{
    public class AppCredentials
    {
        [JsonProperty("AppClientId")]
        public String clientId;

        [JsonProperty("AppClientSecret")]
        public String clientSecret;

        [JsonProperty("AppRefreshToken")]
        public String refreshToken;

    }
}
