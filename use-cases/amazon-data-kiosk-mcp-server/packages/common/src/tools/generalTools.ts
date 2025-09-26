// src/tools/generalTools.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeApiRequest, downloadDocument, readFileContent } from "../api/baseApi.js";
import { formatQueryStatus, formatDocumentContent, formatErrorMessage } from "../utils/formatters.js";
import { API_VERSION } from "../utils/constants.js";

/**
 * Register general Data Kiosk tools with the MCP server
 * @param server The MCP server instance
 */
export function registerGeneralTools(server: McpServer): void {
  // Tool to list all queries
  server.tool(
    "list-queries",
    "List all Data Kiosk queries with optional filtering",
    {
      processingStatus: z.string().optional().describe("Filter queries by processing status (e.g., PROCESSING, SUCCEEDED, FAILED)"),
      pageSize: z.number().min(1).max(100).default(10).describe("Number of results per page"),
      createdSince: z.string().optional().describe("Filter queries created since this date (ISO format)")
    },
    async ({ processingStatus, pageSize, createdSince }) => {
      try {
        let path = `/dataKiosk/${API_VERSION}/queries?pageSize=${pageSize}`;

        if (processingStatus) {
          path += `&processingStatuses=${processingStatus}`;
        }

        if (createdSince) {
          path += `&createdSince=${createdSince}`;
        }

        const result = await makeApiRequest(path, "GET");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: formatErrorMessage(error, "listing queries")
            }
          ]
        };
      }
    }
  );

  // Tool to create a new query
  server.tool(
    "create-query",
    "Create a new GraphQL query for retrieving business analytics data",
    {
      graphqlQuery: z.string().max(8000).describe("GraphQL query string (limited to 8,000 characters excluding whitespace)")
    },
    async ({ graphqlQuery }) => {
      try {
        const body = { query: graphqlQuery };
        const result = await makeApiRequest(`/dataKiosk/${API_VERSION}/queries`, "POST", body);

        return {
          content: [
            {
              type: "text",
              text: `Query created successfully!\n\nQuery ID: ${result.queryId}\nStatus: ${result.status || "PROCESSING"}\n\nUse the 'check-query-status' tool with this Query ID to monitor processing.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: formatErrorMessage(error, "creating query")
            }
          ]
        };
      }
    }
  );

  // Tool to check query status
  server.tool(
    "check-query-status",
    "Check the status of a specific query",
    {
      queryId: z.string().describe("ID of the query to check")
    },
    async ({ queryId }) => {
      try {
        const result = await makeApiRequest(`/dataKiosk/${API_VERSION}/queries/${queryId}`, "GET");
        const statusText = formatQueryStatus(result);

        return {
          content: [
            {
              type: "text",
              text: statusText
            }
          ]
        };
      } catch (error) {
        // Improve error handling with specific guidance based on error type
        let errorMessage = formatErrorMessage(error, `checking query status for ${queryId}`);

        return {
          content: [
            {
              type: "text",
              text: errorMessage
            }
          ]
        };
      }
    }
  );

  // Tool to cancel a query
  server.tool(
    "cancel-query",
    "Cancel a running query",
    {
      queryId: z.string().describe("ID of the query to cancel")
    },
    async ({ queryId }) => {
      try {
        await makeApiRequest(`/dataKiosk/${API_VERSION}/queries/${queryId}`, "DELETE");

        return {
          content: [
            {
              type: "text",
              text: `Query ${queryId} has been successfully canceled.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: formatErrorMessage(error, "canceling query")
            }
          ]
        };
      }
    }
  );

  // Tool to get document details
  server.tool(
    "get-document-details",
    "Get details of a document, including the download URL",
    {
      documentId: z.string().describe("ID of the document to retrieve")
    },
    async ({ documentId }) => {
      try {
        const result = await makeApiRequest(`/dataKiosk/${API_VERSION}/documents/${documentId}`, "GET");

        return {
          content: [
            {
              type: "text",
              text: `Document Details:\n\nDocument ID: ${result.documentId}\nURL: ${result.documentUrl}\n\nNOTE: This URL will expire in 5 minutes.\n\nUse the 'download-document' tool with this URL to download the document content.`
            }
          ]
        };
      } catch (error) {
        // Improve error handling with specific error messages
        const errorMessage = formatErrorMessage(error, `retrieving document details for ${documentId}`);

        return {
          content: [
            {
              type: "text",
              text: errorMessage
            }
          ]
        };
      }
    }
  );

  // Tool to download document content
  server.tool(
    "download-document",
    "Download the content of a document using its URL and save it to the local filesystem",
    {
      url: z.string().url().describe("The URL of the document to download")
    },
    async ({ url }) => {
      try {
        const result = await downloadDocument(url);

        return {
          content: [
            {
              type: "text",
              text: `Document successfully downloaded and saved!

File Details:
- Saved to: ${result.savedPath}
- File size: ${(result.size / 1024).toFixed(2)} KB
- Downloaded at: ${result.timestamp}

Content Preview:
${result.contentPreview}

The complete document has been saved and can be accessed at the path shown above.`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: formatErrorMessage(error, "downloading and saving document")
            }
          ]
        };
      }
    }
  );


  // Tool to get API overview and help
  server.tool(
    "get-api-help",
    "Get help information about the Amazon Data Kiosk API",
    {
      topic: z.enum([
        "overview",
        "authentication",
        "queries",
        "documents",
        "graphql",
        "troubleshooting"
      ]).describe("Topic to get help about")
    },
    async ({ topic }) => {
      let helpText = "";

      switch (topic) {
        case "overview":
          helpText = `
# Amazon Data Kiosk API Overview

Amazon Data Kiosk is a secure, GraphQL-based dynamic reporting suite within the Selling Partner API ecosystem. It allows you to access bulk data and build reporting solutions for Amazon Selling Partners.

## Key Features
- Flexible custom query structuring through GraphQL
- Interactive schema explorer for dataset exploration
- Automated query completion notifications
- Efficient API calls with precise data fetching
- JSONL format reporting
- Secure data access controls

## Available Datasets
- Seller Sales and Traffic (analytics_salesAndTraffic_2024_04_24)
- Seller Economics (analytics_economics_2024_03_15)
- Cross-Domain Vendor Analytics (analytics_vendorAnalytics_2024_09_30)

## Basic Workflow
1. Create a GraphQL query to retrieve specific data
2. Check query status until processing is complete
3. Retrieve document details to get the download URL
4. Download the data for analysis

## Limitations
- Queries are limited to 8,000 characters (excluding whitespace)
- Download URLs expire after 5 minutes
- Appropriate role access is required for different data types
- Data is returned in JSONL format for successful queries`;
          break;

        case "authentication":
          helpText = `
# Authentication for Amazon Data Kiosk API

The Amazon Data Kiosk API uses OAuth 2.0 for authentication.

## Required Credentials
- Client ID: Your application client ID
- Client Secret: Your application client secret
- Refresh Token: OAuth refresh token for your seller account

## Authentication Flow
1. Exchange refresh token for access token using OAuth endpoint
2. Include access token in API requests using x-amz-access-token header
3. Refresh token when it expires (typically after 1 hour)

## Security Best Practices
- Never expose your client secret or refresh token
- Store tokens securely and encrypt them at rest
- Refresh tokens only when needed, and cache valid access tokens
- Implement token rotation and proper error handling

## Common Authentication Issues
- Invalid or expired refresh token
- Incorrect client ID or secret
- Missing or malformed authorization headers
- Region-specific endpoint issues

For more detailed authentication information, refer to the [Selling Partner API Authentication documentation](https://developer-docs.amazon.com/sp-api/docs/sp-api-authentication).`;
          break;

        case "queries":
          helpText = `
# Working with Queries in Amazon Data Kiosk API

Queries are the primary way to retrieve data from the Data Kiosk API.

## Query Lifecycle
1. Create a query with a GraphQL syntax targeting specific data
2. Query enters processing state in Amazon's systems
3. Query completes and generates a document with results
4. Document is available for download for a limited time

## Query Statuses
- IN_QUEUE: The query is waiting to be processed
- IN_PROGRESS: The query is currently being processed
- DONE: The query completed successfully and generated a document
- FATAL: The query failed with errors
- CANCELLED: The query was manually cancelled or timed out

## Query Management
- List queries to see your recent queries
- Check query status to monitor processing
- Cancel a query if it's no longer needed
- Queries and results are automatically deleted after retention period

## Query Limitations
- Maximum query length: 8,000 characters (excluding whitespace)
- Maximum running queries: varies by account tier
- Query timeout: varies by complexity and data volume
- Date range limitations vary by data type

## Query Performance Tips
- Select only the fields you need
- Use appropriate date ranges and aggregations
- Filter data where possible to reduce volume
- Avoid overly complex nested queries`;
          break;

        case "documents":
          helpText = `
# Working with Documents in Amazon Data Kiosk API

Documents contain the results of successful queries.

## Document Types
- Data documents: Contain the requested data in JSONL format
- Error documents: Contain error details for failed queries

## Document Lifecycle
1. Created when a query completes processing
2. Available for download for the retention period
3. Download URL is valid for 5 minutes after retrieval
4. Document is deleted after the retention period

## Working with Documents
- Get document details to retrieve the download URL
- Download the document content using the URL
- Process the document content (typically JSONL format)
- Redownload as needed during the retention period

## Document Format
- Most data is returned in JSONL (JSON Lines) format
- Each line is a valid JSON object representing one record
- Use appropriate JSON parsing with line-by-line processing
- Large documents may need to be processed in chunks

## Document Limitations
- Download URLs expire after 5 minutes
- Maximum document size varies by data type
- Document retention period varies by data type
- Some documents may be compressed`;
          break;

        case "graphql":
          helpText = `
# Using GraphQL with Amazon Data Kiosk API

GraphQL is the query language used to retrieve specific data from the Data Kiosk API.

## GraphQL Basics
- Define queries to specify exactly the data you need
- Select specific fields to return from the response
- Use variables, arguments, and directives to customize queries
- Nest related data in a single query

## Available Schemas
- \`analytics_salesAndTraffic_2024_04_24\`: Seller sales and traffic data
- \`analytics_economics_2024_03_15\`: Seller economics and profitability data
- \`analytics_vendorAnalytics_2024_09_30\`: Vendor analytics data

## Common Query Patterns
- Time-based aggregation (by day, week, month)
- Product-based aggregation (by ASIN, SKU)
- Marketplace filtering
- Metric selection

## GraphQL Tips
- Start with small queries and expand incrementally
- Use query variables for dynamic values
- Test queries before implementing them in production
- Handle errors gracefully

## Example Query Structure
\`\`\`graphql
query MyQuery {
  analytics_salesAndTraffic_2024_04_24 {
    salesAndTrafficByDate(
      startDate: "2025-03-01",
      endDate: "2025-03-31",
      aggregateBy: DAY,
      marketplaceIds: ["ATVPDKIKX0DER"]
    ) {
      startDate
      endDate
      marketplaceId
      sales {
        orderedProductSales {
          amount
          currencyCode
        }
      }
    }
  }
}
\`\`\``;
          break;

        case "troubleshooting":
          helpText = `
# Troubleshooting Amazon Data Kiosk API Issues

Common issues and their solutions when working with the Data Kiosk API.

## Authentication Issues
- **Invalid access token**: Refresh your access token and ensure it's correctly formatted
- **Missing headers**: Ensure x-amz-access-token header is included in all requests
- **Permission errors**: Verify your account has the appropriate roles and permissions

## Query Creation Issues
- **Invalid GraphQL syntax**: Validate your query syntax before submission
- **Field selection errors**: Ensure all selected fields exist in the schema
- **Too many fields**: Simplify queries by selecting only necessary fields
- **Date range errors**: Verify date formats and ensure ranges are valid

## Query Processing Issues
- **Stuck in processing**: Large queries may take time; consider simplifying
- **Failed queries**: Check error documents for specific error messages
- **Timeout errors**: Reduce date ranges or field selection to speed up processing
- **Rate limiting**: Implement backoff strategies for retry logic

## Document Retrieval Issues
- **Expired download URL**: URLs expire after 5 minutes; get a new one if needed
- **Document not found**: Verify document ID and ensure it hasn't expired
- **Parsing errors**: JSONL format requires line-by-line processing
- **Large document handling**: Implement streaming for large documents

## Best Practices
- Implement proper error handling and logging
- Use exponential backoff for retries
- Cache successful query results when possible
- Monitor query performance and optimize as needed

If issues persist, check the [Amazon Selling Partner API documentation](https://developer-docs.amazon.com/sp-api/) or contact Amazon Seller Support.`;
          break;
      }

      return {
        content: [
          {
            type: "text",
            text: helpText
          }
        ]
      };
    }
  );

  // src/tools/generalTools.ts

  // ... (previous imports and code)

  server.tool(
    "read-file",
    "Read content from a file at the specified path",
    {
      filePath: z.string().describe("Path to the file to read"),
      maxLines: z.number().min(1).optional()
        .describe("Maximum number of lines to read (default: entire file)"),
      startLine: z.number().min(1).default(1)
        .describe("Line number to start reading from (default 1)")
    },
    async ({ filePath, maxLines, startLine }) => {
      try {
        const result = await readFileContent(filePath, maxLines, startLine);

        let contentPreview = result.content;
        let contentMessage = '';

        // If the content is very large, truncate it and add a message
        if (contentPreview.length > 10000) {
          contentPreview = contentPreview.substring(0, 10000) + '...';
          contentMessage = '\n\nNote: The content has been truncated due to its large size. Use maxLines parameter to limit the output or read the file directly.';
        }

        return {
          content: [{
            type: "text",
            text: `File Information:
- Path: ${result.fileInfo.path}
- Size: ${result.fileInfo.size}
- Created: ${result.fileInfo.created}
- Last Modified: ${result.fileInfo.modified}
- Total Lines: ${result.fileInfo.totalLines}

Showing lines ${result.startLine} to ${result.endLine} ${result.hasMoreLines ? '(more lines available)' : ''}:

${contentPreview}

${contentMessage}

${result.hasMoreLines ? `\nTo see more lines, adjust startLine and maxLines parameters. Current file has ${result.fileInfo.totalLines} total lines.` : ''}`
          }]
        };

      } catch (error) {
        return {
          content: [{
            type: "text",
            text: formatErrorMessage(error, `reading file at ${filePath}`)
          }]
        };
      }
    }
  );

}