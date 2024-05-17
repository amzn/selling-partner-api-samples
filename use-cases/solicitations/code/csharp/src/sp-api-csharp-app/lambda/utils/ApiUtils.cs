using System;
using System.Reflection;
using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;
using Amazon.SellingPartnerAPIAA;
using Newtonsoft.Json;
using SpApiCsharpApp.swaggerClient.Api;
using SpApiCsharpApp.swaggerClient.Client;
using SpApiCsharpApp.swaggerClient.Model.Solicitations;

namespace SpApiCsharpApp
{
    public class ApiUtils
    {       
        public static SolicitationsApi GetSolicitationsApi (String regionCode, String refreshToken)
        {
            // Set client access credentials from secrets manager and get LWAAuthorization Credentials
            String appCredentialsSecret = GetSecretString(System.Environment.GetEnvironmentVariable(Constants.SpApiAppCredentialsSecretArnEnvVariable));
            AppCredentials appCredentials = JsonConvert.DeserializeObject<AppCredentials>(appCredentialsSecret);            
            LWAAuthorizationCredentials lwaAuthorizationCredentials = GetLWAAuthorizationCredentials(appCredentials,refreshToken,null);
            // Create Solicitations api
            SolicitationsApi api = new SolicitationsApi.Builder()
                   .SetLWAAuthorizationCredentials(lwaAuthorizationCredentials)
                   .Build();
            api.Configuration.UserAgent = "Solicitations Sample App/1.0/C#";
            api.Configuration.BasePath = GetRegionConfig(regionCode);
            return api;
        }

        public static NotificationsApi GetNotificationsApi(String regionCode, String refreshToken,String scope = null)
        {
            // Set client access credentials from secrets manager and get LWAAuthorization Credentials
            String appCredentialsSecret = GetSecretString(System.Environment.GetEnvironmentVariable(Constants.SpApiAppCredentialsSecretArnEnvVariable));
            AppCredentials appCredentials = JsonConvert.DeserializeObject<AppCredentials>(appCredentialsSecret);
            LWAAuthorizationCredentials lwaAuthorizationCredentials = GetLWAAuthorizationCredentials(appCredentials,refreshToken, scope);
            // Create Notifications api with or without based on the operation
            NotificationsApi api = new NotificationsApi.Builder()
                   .SetLWAAuthorizationCredentials(lwaAuthorizationCredentials)
                   .Build();
            api.Configuration.UserAgent = "Solicitations Sample App/1.0/C#";
            api.Configuration.BasePath = GetRegionConfig(regionCode);
            return api;
        }

        private static LWAAuthorizationCredentials GetLWAAuthorizationCredentials(AppCredentials appCredentials,String refreshToken, String scopes)
        {
                 
            LWAAuthorizationCredentials credentials = new LWAAuthorizationCredentials()
            {
                ClientId = appCredentials.clientId,
                ClientSecret = appCredentials.clientSecret,
                Endpoint = new Uri(Constants.LwaEndpoint),
                RefreshToken = refreshToken

            };

            if(scopes!=null)
            {
                credentials.Scopes = new List<string> { scopes };
            }

            return credentials;
        }

        private static String GetRegionConfig(String regionCode)
        {
            if (Constants.RegionEndpointMapping[regionCode] == null)
            {
                String msg = String.Format("Region Code {0} is not valid. Value must be one of {1}",
                        regionCode,
                        Constants.RegionEndpointMapping.Keys);
                throw new ArgumentException(msg);
            }

            return Constants.RegionEndpointMapping[regionCode];
        }

        private static String GetSecretString(String secretId)
        {
            IAmazonSecretsManager client = new AmazonSecretsManagerClient();
            GetSecretValueRequest request = new GetSecretValueRequest()
            {
                SecretId = secretId,
                VersionStage = "AWSCURRENT" // VersionStage defaults to AWSCURRENT if unspecified.
            };

            GetSecretValueResponse response = client.GetSecretValueAsync(request).GetAwaiter().GetResult();

            return response.SecretString;
        }
    }
}

