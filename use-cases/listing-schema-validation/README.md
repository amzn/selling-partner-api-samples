# JsonListingSchemaValidationSampleApp

## Introduction

This app demonstrates how to use the APIs listed in 
[Building Listings Management Workflows Guide](https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide) 
to build a sample specifically for JSON listing schema validation. The app covers steps
1. Check item exist in the Amazon Catalog. 
2. Find listing restrictions if item exist
3. Search Product type given the keywords and get Amazon recommended product type
4. Get the json schema and meta schema of the given product from the product type definition API
5. Store the two schema files locally 
6. use online json editor [tool](https://rjsf-team.github.io/react-jsonschema-form/) to fillout the values 
7. Store the json values payload locally 
8. Validate the json payload against the schema and check any syntax error
9. Send putListingItem request with validation preview mode

## Getting Started

### Prerequisites

1. This app requires Java 11 or above, so please install a supported version
2. This sample app is build using the SP-API Java [SDK](https://github.com/amzn/selling-partner-api-sdk) So make sure
   your project has this dependency in latest version. As of May/21/2025, the latest version is 1.5.6
```xml
    <dependency>
        <groupId>com.networknt</groupId>
        <artifactId>json-schema-validator</artifactId>
        <version>1.5.6</version>
    </dependency>
```
3. This sample app is using netoworknt as its open sourced JSON schema validate library 
   but you could use own one. And here is the Maven dependency look like 
```xml
    <dependency>
        <groupId>com.networknt</groupId>
        <artifactId>json-schema-validator</artifactId>
        <version>1.5.6</version>
    </dependency> 
```


## How to run the app

1. Check out the repository to your computer from Git 
2. Edit config.yml file to include all the necessary values such as client id, client secret, and refresh token
3. Use IntelliJ to open the project
4. Navigate to the Main.java and click the Run button
5. Check the printed result in the console


## See also

1. [SP-API documentation](https://developer-docs.amazon.com/sp-api/docs/welcome)
2. [Building Listings Management Workflows Guide](https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide)
3. [Listing JSON Schema Specification](https://developer-docs.amazon.com/sp-api/docs/product-type-definition-meta-schema)
4. [SP-API SDK](https://github.com/amzn/selling-partner-api-sdk)