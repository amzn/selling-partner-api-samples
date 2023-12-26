# Overview
This folder contains the CSharp implementation of the Vendor Direct Fulfillment use case. The main components of this implementation are:
1. The [dependencies](dependencies) folder contains the dll for the [SP-API C# library with LWA token exchange and authentication](https://developer-docs.amazon.com/sp-api/docs/generate-a-c-sharp-sdk-with-lwa-token-generation-and-authentication
2. The [src/sp-api-csharp-app/swagger_client](src/sp-api-csharp-app/swagger_client) folder contains the Swagger classes of the SP-API CSharp SDK
3. The [src/sp-api-csharp-app/lambda](src/sp-api-csharp-app/lambda) folder contains the backend code of the Lambda functions that support the Vendor Direct Fulfillment workflow.