using System;
using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;
using Amazon.SellingPartnerAPIAA;
using Newtonsoft.Json;
using RestSharp;
using spApiCsharpApp.swaggerClient.Api;
using spApiCsharpApp.swaggerClient.Model.Tokens;

namespace spApiCsharpApp
{
    public class ApiUtils
    {
        
        private static LWAAuthorizationCredentials getLWAAuthorizationCredentials(AppCredentials appCredentials)
        {

            LWAAuthorizationCredentials credentials = new LWAAuthorizationCredentials()
            {
                ClientId = appCredentials.clientId,
                ClientSecret = appCredentials.clientSecret,
                Endpoint = new Uri(Constants.LWA_ENDPOINT),
                RefreshToken = appCredentials.refreshToken,

            };
            
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

        private static String getSecretString(String secretId)
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

        //Get Restricted Data Token
        public static string getRestrictedDataToken(String regionCode, String restrictededResourcePath, String resourceMethod)
        {
            TokensApi tokensApi = ApiUtils.getTokensApis(regionCode);
            
            RestrictedResource.MethodEnum restrictedResourceMethod = (RestrictedResource.MethodEnum)Enum.Parse(typeof(RestrictedResource.MethodEnum), resourceMethod);

            List<RestrictedResource> restrictedResourceList = new List<RestrictedResource>
            {
                new RestrictedResource(restrictedResourceMethod, restrictededResourcePath)               
            
            };
            CreateRestrictedDataTokenRequest createRestrictedDataTokenRequest = new CreateRestrictedDataTokenRequest(null, restrictedResourceList);

            CreateRestrictedDataTokenResponse rdtResponse = tokensApi.CreateRestrictedDataToken(createRestrictedDataTokenRequest);

            return rdtResponse.RestrictedDataToken.ToString();
        }

        //Execute the Restrcited Resource API call
        public static Object buildAndExecuteRestrictedRequest(String regionCode, String restrictedResourcePath, RestSharp.Method method, String jsonRequestBody, Dictionary<String, String> pathParams)
        {
            RestClient restClient = new RestClient(GetRegionConfig(regionCode));
            var request = new RestRequest(restrictedResourcePath, method);
            string restrictedDataToken = ApiUtils.getRestrictedDataToken(regionCode, restrictedResourcePath, method.ToString());
            request.AddHeader("x-amz-access-token", restrictedDataToken);

            // add path parameter, if any
            foreach (var param in pathParams)
                request.AddParameter(param.Key, param.Value, ParameterType.UrlSegment);

            if (jsonRequestBody != null)
            {
                request.AddParameter("application/json", jsonRequestBody, ParameterType.RequestBody);
            }

            var response = restClient.Execute(request);

            return (Object)response;
        }

        //Generate VendorOrder API client
        public static VendorOrdersApi getVendorOrdersApi(String regionCode)
        {           
            String appCredentialsSecret = getSecretString(System.Environment.GetEnvironmentVariable(Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
            AppCredentials appCredentials = JsonConvert.DeserializeObject<AppCredentials>(appCredentialsSecret);
            LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials);            

            VendorOrdersApi api = new VendorOrdersApi.Builder().SetLWAAuthorizationCredentials(lwaAuthorizationCredentials).Build();            
            api.Configuration.BasePath = GetRegionConfig(regionCode);
            api.Configuration.UserAgent = "Vendor Direct Fulfillment Sample App/1.0/C#";

            return api;
        }
        
        //Generate VendorShippingLabel API client
        public static VendorShippingLabelsApi getVendorShippingLabelApi(String regionCode)
        {        
            String appCredentialsSecret = getSecretString(System.Environment.GetEnvironmentVariable(Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
            AppCredentials appCredentials = JsonConvert.DeserializeObject<AppCredentials>(appCredentialsSecret);           
            LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials);

            VendorShippingLabelsApi api = new VendorShippingLabelsApi.Builder().SetLWAAuthorizationCredentials(lwaAuthorizationCredentials).Build();
            api.Configuration.BasePath = GetRegionConfig(regionCode);
            api.Configuration.UserAgent = "Vendor Direct Fulfillment Sample App/1.0/C#";

            return api;
        }
        
        //Generate VendorShipping API client
        public static VendorShippingApi getVendorShippingApi(String regionCode)
        {            
            String appCredentialsSecret = getSecretString(System.Environment.GetEnvironmentVariable(Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
            AppCredentials appCredentials = JsonConvert.DeserializeObject<AppCredentials>(appCredentialsSecret);
            LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials);

            VendorShippingApi api = new VendorShippingApi.Builder().SetLWAAuthorizationCredentials(lwaAuthorizationCredentials).Build();
            api.Configuration.BasePath = GetRegionConfig(regionCode);
            api.Configuration.UserAgent = "Vendor Direct Fulfillment Sample App/1.0/C#";

            return api;
        }

        //Generate VendorTransactions API client
        public static VendorTransactionApi getVendorTransactionApi(String regionCode)
        {            
            String appCredentialsSecret = getSecretString(System.Environment.GetEnvironmentVariable(Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
            AppCredentials appCredentials = JsonConvert.DeserializeObject<AppCredentials>(appCredentialsSecret);
            LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials);

            VendorTransactionApi api = new VendorTransactionApi.Builder().SetLWAAuthorizationCredentials(lwaAuthorizationCredentials).Build();
            api.Configuration.BasePath = GetRegionConfig(regionCode);
            api.Configuration.UserAgent = "Vendor Direct Fulfillment Sample App/1.0/C#";

            return api;
        }

        //Generate VendorUpdateInventory API client
        public static UpdateInventoryApi getVendorUpdateInventoryApi(String regionCode)
        {            
            String appCredentialsSecret = getSecretString(System.Environment.GetEnvironmentVariable(Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
            AppCredentials appCredentials = JsonConvert.DeserializeObject<AppCredentials>(appCredentialsSecret);
            LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials);

            UpdateInventoryApi api = new UpdateInventoryApi.Builder().SetLWAAuthorizationCredentials(lwaAuthorizationCredentials).Build();
            api.Configuration.BasePath = GetRegionConfig(regionCode);
            api.Configuration.UserAgent = "Vendor Direct Fulfillment Sample App/1.0/C#";
            return api;
        }

        //Generate Tokens API client
        public static TokensApi getTokensApis(String regionCode)
        {            
            String appCredentialsSecret = getSecretString(System.Environment.GetEnvironmentVariable(Constants.SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE));
            AppCredentials appCredentials = JsonConvert.DeserializeObject<AppCredentials>(appCredentialsSecret);
            LWAAuthorizationCredentials lwaAuthorizationCredentials = getLWAAuthorizationCredentials(appCredentials);

            TokensApi api = new TokensApi.Builder().SetLWAAuthorizationCredentials(lwaAuthorizationCredentials).Build();
            api.Configuration.BasePath = GetRegionConfig(regionCode);
            return api;
        }
        
    }
}

