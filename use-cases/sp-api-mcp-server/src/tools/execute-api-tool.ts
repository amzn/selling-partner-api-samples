// src/tools/execute-api-tool.ts

import { z } from 'zod';
import axios from 'axios';
import { ApiCatalog, ApiEndpoint, ApiParameter } from '../types/api-catalog.js';
import { logger } from '../utils/logger.js';
import { SpApiAuthenticator } from '../auth/sp-api-auth.js';

export const executeApiSchema = z.object({
  endpoint: z.string().describe("The specific SP-API endpoint to use (required)"),
  parameters: z.record(z.any()).describe("Complete set of API parameters"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional().describe("HTTP method"),
  additionalHeaders: z.record(z.string()).optional().describe("Additional request headers"),
  rawMode: z.boolean().optional().default(false).describe("Return raw response if true"),
  generateCode: z.boolean().optional().default(false).describe("Generate code snippet if true"),
  region: z.string().optional().default("us-east-1").describe("AWS region for the request")
});

export type ExecuteApiParams = z.infer<typeof executeApiSchema>;

interface ExecutionResult {
  success: boolean;
  statusCode?: number;
  statusMessage?: string;
  requestDetails: {
    endpoint: string;
    method: string;
    path: string;
    parameters: object;
    headers: {
      sent: Record<string, string>;
      received: Record<string, string>;
    };
    body?: object;
  };
  response: {
    raw: any;
    formatted: any;
    highlights: string[];
  };
  insights: string[];
  nextSteps: string[];
  codeSnippet?: string;
  errorDetails?: {
    code: string;
    message: string;
    recommendations: string[];
  };
}

export class ExecuteApiTool {
  constructor(
    private catalog: ApiCatalog,
    private authenticator: SpApiAuthenticator
  ) { }

  async execute(params: ExecuteApiParams): Promise<string> {
    logger.debug('Executing execute-sp-api tool with params:', JSON.stringify(params, null, 2));

    try {
      // Find the endpoint in the catalog
      const endpoint = this.findEndpoint(params.endpoint);
      if (!endpoint) {
        return this.formatError(`Endpoint '${params.endpoint}' not found in the catalog`);
      }

      // Validate parameters
      const validationResult = this.validateParameters(endpoint, params.parameters);
      if (validationResult.errors.length > 0) {
        return this.formatError(
          `Parameter validation failed: ${validationResult.errors.join(', ')}`,
          validationResult.errors
        );
      }

      // Override method if specified
      const method = params.method || endpoint.method;

      // Build request URL
      const url = this.buildUrl(endpoint, params.parameters, params.region);

      // Prepare headers
      const headers = this.prepareHeaders(endpoint, params.additionalHeaders);

      // Prepare request body for POST/PUT
      const body = this.prepareBody(endpoint, params.parameters);

      // Sign and execute the request
      const result = await this.executeRequest({
        method,
        url,
        headers,
        body,
        endpoint,
        params
      });

      // Format the result
      return this.formatResult(result, params);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error executing SP-API request:', error);
      return this.formatError(`Error executing SP-API request: ${errorMessage}`);
    }
  }

  /**
   * Find endpoint in the catalog by ID (supports both unique IDs and original operation IDs)
   */
  private findEndpoint(endpointId: string): ApiEndpoint | undefined {
    // First, try to find by unique ID (new format)
    for (const category of this.catalog.categories) {
      const endpoint = category.endpoints.find(e => e.id === endpointId);
      if (endpoint) {
        return endpoint;
      }

      // Check subcategories if present
      if (category.subcategories) {
        for (const subcategory of category.subcategories) {
          const endpoint = subcategory.endpoints.find(e => e.id === endpointId);
          if (endpoint) {
            return endpoint;
          }
        }
      }
    }

    // Fallback: search by original operation ID for backward compatibility
    // But prioritize "Orders" category for common operations like "getOrders"
    const priorityCategories = ['Orders', 'FBA Inventory', 'Reports'];
    
    // Check priority categories first
    for (const priorityCategoryName of priorityCategories) {
      const category = this.catalog.categories.find(c => c.name === priorityCategoryName);
      if (category) {
        const endpoint = category.endpoints.find(e => e.originalOperationId === endpointId);
        if (endpoint) {
          return endpoint;
        }

        // Check subcategories if present
        if (category.subcategories) {
          for (const subcategory of category.subcategories) {
            const endpoint = subcategory.endpoints.find(e => e.originalOperationId === endpointId);
            if (endpoint) {
              return endpoint;
            }
          }
        }
      }
    }

    // Then check all other categories
    for (const category of this.catalog.categories) {
      if (priorityCategories.includes(category.name)) {
        continue; // Skip already checked categories
      }

      const endpoint = category.endpoints.find(e => e.originalOperationId === endpointId);
      if (endpoint) {
        return endpoint;
      }

      // Check subcategories if present
      if (category.subcategories) {
        for (const subcategory of category.subcategories) {
          const endpoint = subcategory.endpoints.find(e => e.originalOperationId === endpointId);
          if (endpoint) {
            return endpoint;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Validate parameters against endpoint definition
   */
  private validateParameters(
    endpoint: ApiEndpoint,
    parameters: Record<string, any>
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required parameters
    for (const param of endpoint.parameters) {
      if (param.required && parameters[param.name] === undefined) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
    }

    // Check for unknown parameters (warning only)
    for (const key of Object.keys(parameters)) {
      if (!endpoint.parameters.some(p => p.name === key)) {
        warnings.push(`Unknown parameter: ${key}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
 * Build request URL from endpoint and parameters
 */
  private buildUrl(
    endpoint: ApiEndpoint,
    parameters: Record<string, any>,
    region: string
  ): string {
    // Use configured base URL or map selling regions to SP-API endpoints
    let spApiEndpoint = this.authenticator.getBaseUrl();

    // If using default base URL, apply region logic
    if (spApiEndpoint === 'https://sellingpartnerapi-na.amazon.com') {
      // Convert region to lowercase for case-insensitive comparison
      const regionLower = region.toLowerCase();

      // Map selling region to the correct endpoint
      if (regionLower.includes('na') ||
        regionLower.includes('north america') ||
        regionLower.includes('us') ||
        regionLower.includes('canada') ||
        regionLower.includes('mexico') ||
        regionLower.includes('brazil') ||
        regionLower === 'us-east-1') {
        spApiEndpoint = 'https://sellingpartnerapi-na.amazon.com';
      } else if (regionLower.includes('eu') ||
        regionLower.includes('europe') ||
        regionLower.includes('uk') ||
        regionLower.includes('germany') ||
        regionLower.includes('france') ||
        regionLower.includes('italy') ||
        regionLower.includes('spain') ||
        regionLower.includes('india')) {
        spApiEndpoint = 'https://sellingpartnerapi-eu.amazon.com';
      } else if (regionLower.includes('fe') ||
        regionLower.includes('far east') ||
        regionLower.includes('japan') ||
        regionLower.includes('australia') ||
        regionLower.includes('singapore')) {
        spApiEndpoint = 'https://sellingpartnerapi-fe.amazon.com';
      } else {
        // Log a warning if region doesn't match known patterns
        logger.warn(`Unknown region '${region}', defaulting to North America endpoint`);
      }
    }

    // Start with the endpoint path
    let path = endpoint.path;

    // Replace path parameters
    const pathParams = endpoint.parameters.filter(p => p.location === 'path');
    for (const param of pathParams) {
      if (parameters[param.name]) {
        path = path.replace(`{${param.name}}`, encodeURIComponent(parameters[param.name]));
      }
    }

    // Add query parameters
    const queryParams = endpoint.parameters.filter(p => p.location === 'query');
    if (queryParams.length > 0) {
      const queryParts: string[] = [];

      for (const param of queryParams) {
        if (parameters[param.name] !== undefined) {
          // Handle array parameters
          if (Array.isArray(parameters[param.name])) {
            for (const value of parameters[param.name]) {
              queryParts.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`);
            }
          } else {
            queryParts.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(parameters[param.name])}`);
          }
        }
      }

      if (queryParts.length > 0) {
        path += `?${queryParts.join('&')}`;
      }
    }

    return `${spApiEndpoint}${path}`;
  }

  /**
   * Prepare headers for the request
   */
  private prepareHeaders(
    endpoint: ApiEndpoint,
    additionalHeaders?: Record<string, string>
  ): Record<string, string> {
    // Start with standard headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'SP-API-MCP-Server/1.0.0'
    };

    // Add endpoint-specific headers from parameters
    const headerParams = endpoint.parameters.filter(p => p.location === 'header');
    for (const param of headerParams) {
      if (param.required && 'default' in param && param.default !== undefined) {
        headers[param.name] = String(param.default);
      }
    }

    // Add or override with additional headers if provided
    if (additionalHeaders) {
      Object.assign(headers, additionalHeaders);
    }

    return headers;
  }

  /**
   * Prepare request body for POST/PUT requests
   */
  private prepareBody(
    endpoint: ApiEndpoint,
    parameters: Record<string, any>
  ): any {
    // For GET/DELETE, no body is needed
    if (endpoint.method === 'GET' || endpoint.method === 'DELETE') {
      return undefined;
    }

    // For POST/PUT, look for body parameter or construct from provided parameters
    const bodyParam = endpoint.parameters.find(p => p.location === 'body');
    if (bodyParam && parameters[bodyParam.name]) {
      return parameters[bodyParam.name];
    }

    // If no specific body parameter, construct from non-path, non-query parameters
    const bodyParams = endpoint.parameters.filter(
      p => p.location !== 'path' && p.location !== 'query' && p.location !== 'header'
    );

    if (bodyParams.length > 0) {
      const body: Record<string, any> = {};

      for (const param of bodyParams) {
        if (parameters[param.name] !== undefined) {
          body[param.name] = parameters[param.name];
        }
      }

      return Object.keys(body).length > 0 ? body : undefined;
    }

    return undefined;
  }

  // In the executeRequest method in src/tools/execute-api-tool.ts
  // Add this before making the axios call:

  private async executeRequest({
    method,
    url,
    headers,
    body,
    endpoint,
    params
  }: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
    endpoint: ApiEndpoint;
    params: ExecuteApiParams;
  }): Promise<ExecutionResult> {
    try {
      logger.debug(`Executing ${method} request to ${url}`);

      // Sign the request
      const signedRequest = await this.authenticator.signRequest({
        method,
        url,
        headers,
        body
      });

      // Add debug logging for the complete request
      logger.info('==== FULL REQUEST DETAILS ====');
      logger.info(`Method: ${signedRequest.method}`);
      logger.info(`URL: ${signedRequest.url}`);
      logger.info('Headers:');
      Object.entries(signedRequest.headers).forEach(([key, value]) => {
        // Don't log sensitive information like auth tokens
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
          logger.info(`  ${key}: [REDACTED]`);
        } else {
          logger.info(`  ${key}: ${value}`);
        }
      });

      if (signedRequest.body) {
        logger.info('Body:');
        logger.info(JSON.stringify(signedRequest.body, null, 2));
      }
      logger.info('============================');

      // Execute the request
      const response = await axios({
        method: signedRequest.method,
        url: signedRequest.url,
        headers: signedRequest.headers,
        data: signedRequest.body,
        validateStatus: () => true // Don't throw on error status codes
      });

      // Add debug logging for the response
      logger.info('==== FULL RESPONSE DETAILS ====');
      logger.info(`Status: ${response.status} ${response.statusText}`);
      logger.info('Headers:');
      Object.entries(response.headers).forEach(([key, value]) => {
        logger.info(`  ${key}: ${value}`);
      });
      logger.info('Body:');
      logger.info(JSON.stringify(response.data, null, 2));
      logger.info('==============================');

      logger.debug(`Response received: ${response.status} ${response.statusText}`);


      // Process response
      const success = response.status >= 200 && response.status < 300;
      const rawResponse = response.data;

      // Extract key information and insights
      const highlights = this.extractHighlights(rawResponse, endpoint);
      const insights = this.generateInsights(rawResponse, endpoint, success);
      const nextSteps = this.suggestNextSteps(endpoint, success);

      // Generate code snippet if requested
      let codeSnippet;
      if (params.generateCode) {
        codeSnippet = this.generateCodeSnippet(method, url, headers, body, endpoint);
      }

      // Prepare result
      const result: ExecutionResult = {
        success,
        statusCode: response.status,
        statusMessage: response.statusText,
        requestDetails: {
          endpoint: endpoint.id,
          method,
          path: url,
          parameters: params.parameters,
          headers: {
            sent: signedRequest.headers,
            received: response.headers as Record<string, string>
          },
          body
        },
        response: {
          raw: rawResponse,
          formatted: this.formatResponse(rawResponse, params.rawMode),
          highlights
        },
        insights,
        nextSteps,
        codeSnippet
      };

      // Add error details if needed
      if (!success) {
        result.errorDetails = {
          code: response.data?.errors?.[0]?.code || String(response.status),
          message: response.data?.errors?.[0]?.message || response.statusText,
          recommendations: this.generateErrorRecommendations(response.status, response.data)
        };
      }

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorCode = (error as any)?.code || 'UNKNOWN_ERROR';

      logger.error('Error executing SP-API request:', error);

      // Prepare error result
      return {
        success: false,
        requestDetails: {
          endpoint: endpoint.id,
          method,
          path: url,
          parameters: params.parameters,
          headers: {
            sent: headers,
            received: {}
          },
          body
        },
        response: {
          raw: null,
          formatted: null,
          highlights: []
        },
        insights: [
          'The request could not be completed due to an error.',
          `Error: ${errorMessage}`
        ],
        nextSteps: [
          'Check your authentication credentials',
          'Verify your network connection',
          'Check if the SP-API service is available'
        ],
        errorDetails: {
          code: errorCode,
          message: errorMessage,
          recommendations: [
            'Verify your SP-API credentials',
            'Check your AWS credentials if using role-based authentication',
            'Make sure you have the correct permissions for this operation'
          ]
        }
      };
    }
  }

  /**
   * Format API response based on rawMode flag
   */
  private formatResponse(response: any, rawMode: boolean): any {
    if (rawMode) {
      return response;
    }

    // Format the response for better readability
    return response;
  }

  /**
   * Extract key highlights from the response
   */
  private extractHighlights(response: any, endpoint: ApiEndpoint): string[] {
    if (!response) return [];

    const highlights: string[] = [];

    // Try to extract key information based on endpoint type
    if (typeof response === 'object') {
      // Look for key fields in the response
      const keyFields = ['id', 'status', 'count', 'total', 'nextToken', 'payload'];

      for (const field of keyFields) {
        if (response[field] !== undefined) {
          highlights.push(`${field}: ${JSON.stringify(response[field])}`);
        }
      }

      // Look for arrays to summarize
      for (const [key, value] of Object.entries(response)) {
        if (Array.isArray(value)) {
          highlights.push(`${key}: ${value.length} item(s)`);

          // Sample the first item if available
          if (value.length > 0 && typeof value[0] === 'object') {
            const sampleItem = value[0];
            const sampleProps = Object.keys(sampleItem).slice(0, 3); // Show up to 3 properties
            const sampleValues = sampleProps.map(prop =>
              `${prop}: ${JSON.stringify(sampleItem[prop]).substring(0, 50)}`
            );
            highlights.push(`Sample item properties: ${sampleValues.join(', ')}`);
          }
        }
      }

      // Check for inventory-specific highlights
      if (endpoint.id.includes('Inventory')) {
        if (response.payload?.inventorySummaries) {
          const summaries = response.payload.inventorySummaries;
          highlights.push(`Found ${summaries.length} inventory items`);

          // Summarize fulfillable quantities if available
          let totalFulfillable = 0;
          let itemsWithInventory = 0;

          for (const summary of summaries) {
            const fulfillable = summary.inventoryDetails?.fulfillableQuantity || 0;
            if (fulfillable > 0) {
              itemsWithInventory++;
              totalFulfillable += fulfillable;
            }
          }

          if (itemsWithInventory > 0) {
            highlights.push(`Total fulfillable quantity: ${totalFulfillable} units across ${itemsWithInventory} SKUs`);
          }
        }
      }
    }

    return highlights;
  }

  /**
   * Generate insights about the response
   */
  private generateInsights(
    response: any,
    endpoint: ApiEndpoint,
    success: boolean
  ): string[] {
    if (!success || !response) {
      return ['The request was not successful. Please check the error details.'];
    }

    const insights: string[] = [
      'The request was successful.'
    ];

    // Add endpoint-specific insights
    if (endpoint.id.includes('get') || endpoint.id.includes('list')) {
      if (response.nextToken || response.payload?.nextToken) {
        insights.push('There are more results available. Use the nextToken parameter to retrieve the next page.');
      }

      let itemCount = 0;
      if (Array.isArray(response)) {
        itemCount = response.length;
      } else if (response.payload && Array.isArray(response.payload)) {
        itemCount = response.payload.length;
      } else if (response.items && Array.isArray(response.items)) {
        itemCount = response.items.length;
      } else if (response.payload?.inventorySummaries) {
        itemCount = response.payload.inventorySummaries.length;
      }

      if (itemCount > 0) {
        insights.push(`Retrieved ${itemCount} item(s).`);
      } else {
        insights.push('No items were retrieved. This could be due to filtering or because there are no items available.');
      }
    }

    // Add inventory-specific insights
    if (endpoint.id.includes('Inventory') && response.payload?.inventorySummaries) {
      const summaries = response.payload.inventorySummaries;

      // Check for unfulfillable inventory
      let totalUnfulfillable = 0;
      let skusWithUnfulfillable = 0;

      for (const summary of summaries) {
        const unfulfillable = summary.inventoryDetails?.unfulfillableQuantity?.totalUnfulfillableQuantity || 0;
        if (unfulfillable > 0) {
          skusWithUnfulfillable++;
          totalUnfulfillable += unfulfillable;
        }
      }

      if (skusWithUnfulfillable > 0) {
        insights.push(`Found ${totalUnfulfillable} unfulfillable units across ${skusWithUnfulfillable} SKUs. Consider checking these items.`);
      }

      // Check for reserved inventory
      let skusWithReserved = 0;
      for (const summary of summaries) {
        const reserved = summary.inventoryDetails?.reservedQuantity?.totalReservedQuantity || 0;
        if (reserved > 0) {
          skusWithReserved++;
        }
      }

      if (skusWithReserved > 0) {
        insights.push(`${skusWithReserved} SKUs have units reserved for customer orders or other processes.`);
      }
    }

    return insights;
  }

  /**
   * Suggest next steps based on endpoint and execution result
   */
  private suggestNextSteps(endpoint: ApiEndpoint, success: boolean): string[] {
    if (!success) {
      return [
        'Review the error details and fix any issues with your request.',
        'Check your authentication credentials.',
        'Verify that you have the necessary permissions for this operation.'
      ];
    }

    const nextSteps: string[] = [];

    // Add endpoint-specific next steps
    if (endpoint.relatedEndpoints.length > 0) {
      nextSteps.push('You may want to try these related endpoints:');
      for (const related of endpoint.relatedEndpoints) {
        nextSteps.push(`- ${related.id}: ${related.relationship}`);
      }
    }

    // Add generic next steps based on endpoint type
    if (endpoint.id.includes('get') || endpoint.id.includes('list')) {
      nextSteps.push('Use the retrieved data for your business needs.');

      if (endpoint.id.includes('list')) {
        nextSteps.push('Consider retrieving additional pages if nextToken is present.');
        nextSteps.push('Filter results to narrow down to specific items if needed.');
      }
    } else if (endpoint.id.includes('create') || endpoint.id.includes('add')) {
      nextSteps.push('Use the ID of the created resource for subsequent operations.');
      nextSteps.push('Verify the created resource details.');
    } else if (endpoint.id.includes('update')) {
      nextSteps.push('Verify that the update was successful.');
      nextSteps.push('Retrieve the updated resource to confirm changes.');
    } else if (endpoint.id.includes('delete')) {
      nextSteps.push('Verify that the deletion was successful.');
    }

    // Add inventory-specific next steps
    if (endpoint.id.includes('Inventory')) {
      nextSteps.push('Consider creating an inbound shipment for low-stock items.');
      nextSteps.push('Check for unfulfillable inventory and determine the cause.');
    }

    return nextSteps;
  }

  /**
   * Generate code snippet for the request
   */
  private generateCodeSnippet(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: any,
    endpoint: ApiEndpoint
  ): string {
    // Generate JavaScript/Node.js code by default
    return `
// Amazon SP-API Client for ${endpoint.id}
const axios = require('axios');
const aws4 = require('aws4');
const url = require('url');

// Function to get and refresh access token
async function getAccessToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', 'YOUR_REFRESH_TOKEN');
  params.append('client_id', 'YOUR_CLIENT_ID');
  params.append('client_secret', 'YOUR_CLIENT_SECRET');
  
  try {
    const response = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    throw error;
  }
}

async function execute${this.capitalize(endpoint.id)}() {
  try {
    // Get access token
    const accessToken = await getAccessToken();
    
    // Parse URL
    const parsedUrl = new url.URL('${url}');
    
    // Prepare request for signing
    const request = {
      host: parsedUrl.host,
      method: '${method}',
      path: \`\${parsedUrl.pathname}\${parsedUrl.search}\`,
      headers: {
        'x-amz-access-token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'YourApp/1.0.0',
        host: parsedUrl.host
      }${body ? `,
      body: JSON.stringify(${JSON.stringify(body, null, 2)})` : ''}
    };
    
    // Sign the request with AWS Signature V4
    const signedRequest = aws4.sign(request, {
      // Replace with your AWS credentials
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN
    });
    
    // Execute the request
    const response = await axios({
      method: '${method}',
      url: '${url}',
      headers: signedRequest.headers,
      data: ${body ? 'JSON.parse(signedRequest.body)' : 'undefined'}
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Execute the function
execute${this.capitalize(endpoint.id)}()
  .then(result => console.log('Operation completed successfully'))
  .catch(error => console.error('Operation failed:', error.message));
`.trim();
  }

  /**
   * Generate recommendations for error handling
   */
  private generateErrorRecommendations(
    statusCode: number,
    errorResponse: any
  ): string[] {
    const recommendations: string[] = [];

    switch (statusCode) {
      case 400:
        recommendations.push('Check your request parameters for errors.');
        recommendations.push('Verify that all required parameters are provided.');
        recommendations.push('Ensure parameter formats are correct.');
        break;
      case 401:
        recommendations.push('Your authentication credentials are invalid or expired.');
        recommendations.push('Refresh your access token and try again.');
        break;
      case 403:
        recommendations.push('You do not have permission to perform this operation.');
        recommendations.push('Verify that you have the necessary roles and permissions.');
        recommendations.push('Check if you are using the correct marketplace ID.');
        break;
      case 404:
        recommendations.push('The requested resource was not found.');
        recommendations.push('Verify that the ID or path is correct.');
        break;
      case 429:
        recommendations.push('You have exceeded the rate limits for this operation.');
        recommendations.push('Implement exponential backoff and retry later.');
        recommendations.push('Consider reducing your request frequency.');
        break;
      case 500:
      case 503:
        recommendations.push('Amazon SP-API is experiencing internal issues.');
        recommendations.push('Wait and retry the request later.');
        recommendations.push('Check the Amazon Seller Central status page for service outages.');
        break;
      default:
        recommendations.push('Review the error details for more information.');
        recommendations.push('Check the SP-API documentation for this endpoint.');
    }

    // Add specific recommendations based on error code/message if available
    if (errorResponse?.errors) {
      for (const error of errorResponse.errors) {
        if (error.code === 'InvalidInput') {
          recommendations.push('One or more input parameters are invalid. Check the error details.');
        } else if (error.code === 'AccessDenied') {
          recommendations.push('You do not have access to this resource. Verify your permissions.');
        } else if (error.code === 'QuotaExceeded') {
          recommendations.push('You have exceeded your quota for this operation. Try again later.');
        } else if (error.code === 'ResourceNotFound') {
          recommendations.push('The requested resource does not exist. Verify your identifiers.');
        }
      }
    }

    return recommendations;
  }

  /**
   * Format error message for tool response
   */
  private formatError(message: string, details: string[] = []): string {
    let errorMessage = `# SP-API Request Error\n\n`;
    errorMessage += `## Error Message\n${message}\n\n`;

    if (details.length > 0) {
      errorMessage += `## Details\n`;
      for (const detail of details) {
        errorMessage += `- ${detail}\n`;
      }
      errorMessage += '\n';
    }

    errorMessage += `## Recommendations\n`;
    errorMessage += `- Verify your endpoint ID and parameters\n`;
    errorMessage += `- Check the SP-API documentation for correct usage\n`;
    errorMessage += `- Ensure your authentication credentials are correct\n`;

    return errorMessage;
  }

  /**
   * Format successful result
   */
  private formatResult(result: ExecutionResult, params: ExecuteApiParams): string {
    // Start with a header
    let formattedResult = `# SP-API ${result.success ? 'Response' : 'Error'}\n\n`;

    // Add status information
    formattedResult += `${result.success ? '✅' : '❌'} **Status**: ${result.statusCode} ${result.statusMessage}\n\n`;

    // Request details section
    formattedResult += `## Request Details\n`;
    formattedResult += `- **Endpoint**: ${result.requestDetails.endpoint}\n`;
    formattedResult += `- **Method**: ${result.requestDetails.method}\n`;
    formattedResult += `- **URL**: ${result.requestDetails.path}\n`;

    // Parameters
    formattedResult += `\n### Parameters\n`;
    formattedResult += `\`\`\`json\n${JSON.stringify(result.requestDetails.parameters, null, 2)}\n\`\`\`\n\n`;

    // Response section
    formattedResult += `## Response\n`;

    if (result.success) {
      // Highlights
      if (result.response.highlights && result.response.highlights.length > 0) {
        formattedResult += `### Highlights\n`;
        for (const highlight of result.response.highlights) {
          formattedResult += `- ${highlight}\n`;
        }
        formattedResult += '\n';
      }

      // Response body
      formattedResult += `### Response Body\n`;
      if (params.rawMode) {
        formattedResult += `\`\`\`json\n${JSON.stringify(result.response.raw, null, 2)}\n\`\`\`\n\n`;
      } else {
        formattedResult += `\`\`\`json\n${JSON.stringify(result.response.formatted || result.response.raw, null, 2)}\n\`\`\`\n\n`;
      }
    } else if (result.errorDetails) {
      // Error details
      formattedResult += `### Error\n`;
      formattedResult += `- **Code**: ${result.errorDetails.code}\n`;
      formattedResult += `- **Message**: ${result.errorDetails.message}\n\n`;

      formattedResult += `### Recommendations\n`;
      for (const recommendation of result.errorDetails.recommendations) {
        formattedResult += `- ${recommendation}\n`;
      }
      formattedResult += '\n';
    }

    // Insights section
    if (result.insights && result.insights.length > 0) {
      formattedResult += `## Insights\n`;
      for (const insight of result.insights) {
        formattedResult += `- ${insight}\n`;
      }
      formattedResult += '\n';
    }

    // Next steps section
    if (result.nextSteps && result.nextSteps.length > 0) {
      formattedResult += `## Next Steps\n`;
      for (const step of result.nextSteps) {
        formattedResult += `- ${step}\n`;
      }
      formattedResult += '\n';
    }

    // Code snippet section
    if (result.codeSnippet) {
      formattedResult += `## Code Snippet\n`;
      formattedResult += `\`\`\`javascript\n${result.codeSnippet}\n\`\`\`\n`;
    }

    return formattedResult;
  }

  /**
   * Capitalize first letter of a string
   */
  private capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}