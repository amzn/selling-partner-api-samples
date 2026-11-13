# Amazon Selling Partner API Samples

This repository contains sample code in various programming languages for use cases supported by the [Amazon Selling Partner API (SP-API)](https://developer-docs.amazon.com/sp-api/).

> [!IMPORTANT]  
> SP-API code samples are example code that demonstrates practical implementations of SP-APIs for specific use cases and scenarios.
> 
> These sample solutions are not supported products in their own right, but educational examples to help our customers use our products for their applications. As our customer, any applications you integrate these examples into should be thoroughly tested, secured, and optimized according to your business's security standards & policies before deploying to production or handling production workloads.

## Table of Contents
- [About this Repo](#about-this-repo)
- [Repository Structure](#repository-structure)
  - [1. SP-API Application Setup](#1-sp-api-application-setup)
  - [2. Product Listings Management](#2-product-listings-management)
  - [3. Code Recipes](#3-code-recipes)
- [Learning Resources](#learning-resources)
- [Security](#security)
- [License](#license)

## About this Repo
This repository contains sample solutions, developer tools (including MCP servers and a local sandbox), and code recipes for the Selling Partner API. Content is organized into numbered top-level folders that group samples by topic, so you can start with application setup and move on to specific business use cases.

We welcome contributions to this repo in the form of fixes or improvements to existing content. For more information on contributing, please see the [CONTRIBUTING](CONTRIBUTING.md) guide.

This is considered an intermediate learning resource, and should typically be referenced after reading the [SP-API Documentation](https://developer-docs.amazon.com/sp-api). Please see [Learning Resources](#learning-resources) for additional resources.

## Repository Structure

```
selling-partner-api-samples/
├── 1-sp-api-application-setup/
│   ├── amazon-data-kiosk-mcp-server/
│   ├── auth-lifecycle-management/
│   ├── local-ai-sandbox/
│   ├── notifications/
│   ├── sp-api-dev-mcp/
│   └── website-authorization/
├── 2-product-listings-management/
│   ├── aplus-content-manager/
│   └── listings/
└── 3-code-recipes/
    ├── java/
    ├── php/
    ├── python/
    └── test/
```

### 1. SP-API Application Setup
Samples and tools for building, authorizing, testing, and operating an SP-API application.

| Sample | Description |
| ------ | ----------- |
| [Local MCP for SP-API](1-sp-api-application-setup/sp-api-dev-mcp) | A local MCP server that bundles SP-API developer tools into a single npm package, including the [Developer Assistant MCP server](1-sp-api-application-setup/sp-api-dev-mcp/sp-api-dev-assistant-mcp-server) (API execution, catalog exploration, migration assistance, code generation, documentation search) and the [Workflow MCP server](1-sp-api-application-setup/sp-api-dev-mcp/sp-api-workflow-mcp) (build and run SP-API workflows from natural language). |
| [Sample AI Sandbox](1-sp-api-application-setup/local-ai-sandbox) | A local development tool for testing SP-API integrations before deploying to production. It validates requests against SP-API OpenAPI schemas and serves responses from deterministic, local operation handlers backed by an in-process database. |
| [Data Kiosk MCP Server](1-sp-api-application-setup/amazon-data-kiosk-mcp-server) | An MCP server that lets AI assistants query the Data Kiosk API to analyze seller and vendor data. |
| [Authorization Lifecycle Management](1-sp-api-application-setup/auth-lifecycle-management) | A guide and sample implementation for managing SP-API authorization, from initial setup to credential rotation. |
| [Website Authorization](1-sp-api-application-setup/website-authorization) | A sample implementation of the OAuth website authorization workflow based on Login with Amazon. |
| [Notifications](1-sp-api-application-setup/notifications) | An event-driven, multi-cloud pipeline that processes [SP-API Notifications](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference) using AWS services and Java. |

### 2. Product Listings Management
Sample solutions for creating and managing product listings and content.

| Sample | Description |
| ------ | ----------- |
| [A+ Content Manager](2-product-listings-management/aplus-content-manager) | A local web application (React and Node.js) for creating, editing, and submitting A+ Content documents, with a credential-free sample data mode. |
| [Listings](2-product-listings-management/listings) | A sample application that demonstrates common listings management workflows from the [Building Listings Management Workflows Guide](https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide). |

### 3. Code Recipes
[Code Recipes](3-code-recipes) are easy to read sample code for common SP-API use cases, available in [Java](3-code-recipes/java), [Python](3-code-recipes/python), and [PHP](3-code-recipes/php). You can browse through them and copy parts of them into your codebase. See the [Code Recipes README](3-code-recipes/README.md) for the full list of recipes.

## Learning Resources
* [SP-API Website](https://developer.amazonservices.com)
* [SP-API SDK](https://github.com/amzn/selling-partner-api-sdk)
* [SP-API Documentation](https://developer-docs.amazon.com/sp-api)
* [SP-API Developer Support](https://developer.amazonservices.com/support)

## Security

See [CONTRIBUTING](CONTRIBUTING.md) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.
