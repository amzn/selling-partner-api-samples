// src/tools/explore-catalog-tool.ts

import { z } from 'zod';
import { ApiCatalog, ApiEndpoint, ApiCategory } from '../types/api-catalog.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// Enhanced validation with better error messages
function createDepthValidator() {
  return z.union([z.number(), z.string()]).transform((val, ctx) => {
    // Handle null, undefined, and empty values
    if (val === null || val === undefined || val === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: JSON.stringify({
          error: "Invalid depth parameter",
          message: `The 'depth' parameter must be a number (0, 1, 2, etc.) or the string 'full'. Received: ${val}. TIP: To get full expansion, simply OMIT the depth parameter entirely - do not pass null/undefined.`,
          validExamples: [
            {"endpoint": "orders_getOrder"},
            {"endpoint": "orders_getOrder", "depth": 2},
            {"endpoint": "orders_getOrder", "depth": "full"}
          ]
        })
      });
      return z.NEVER;
    }
    
    // If it's already a number, validate it
    if (typeof val === 'number') {
      if (val < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: JSON.stringify({
            error: "Invalid depth parameter",
            message: `Depth must be non-negative. Received: ${val}`,
            validExamples: [
              {"depth": 0},
              {"depth": 1},
              {"depth": 2}
            ]
          })
        });
        return z.NEVER;
      }
      return val;
    }
    
    // If it's a string, handle "full" or convert to number
    if (val === "full") return val;
    
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: JSON.stringify({
          error: "Invalid depth parameter",
          message: `The 'depth' parameter must be a number (0, 1, 2, etc.) or the string 'full'. Received: "${val}". Cannot parse as valid number. TIP: To get full expansion, simply OMIT the depth parameter entirely.`,
          validExamples: [
            {"endpoint": "orders_getOrder"},
            {"endpoint": "orders_getOrder", "depth": "full"},
            {"endpoint": "orders_getOrder", "depth": 2}
          ]
        })
      });
      return z.NEVER;
    }
    return num;
  }).optional().default("full").describe("Control nested object expansion depth. When NOT specified, defaults to 'full' (complete expansion). REQUIRED: Must be either a number (0, 1, 2, 3, etc.) for specific depth levels, or the string 'full' for complete expansion. Invalid values like null, undefined, or empty strings will cause errors. IMPORTANT: Omit this parameter entirely for full expansion - do NOT pass null or undefined.");
}

export const exploreCatalogSchema = z.object({
  endpoint: z.string().optional().describe("Specific endpoint to get details for"),
  category: z.string().optional().describe("Category to explore"),
  listEndpoints: z.boolean().optional().default(false).describe("List all available endpoints"),
  listCategories: z.boolean().optional().default(false).describe("List all available categories"),
  depth: createDepthValidator(),
  ref: z.string().optional().describe("Extract specific nested object using dot notation (e.g., 'Order.ShippingAddress')")
});

export type ExploreCatalogParams = z.infer<typeof exploreCatalogSchema>;

export class ExploreCatalogTool {
  constructor(private catalog: ApiCatalog) { }

  private listAllCategories(): string {
    let result = `# All SP-API Categories\n\n`;

    result += `Total categories: ${this.catalog.categories.length}\n\n`;

    result += `| Category | Description | Endpoints Count |\n`;
    result += `| -------- | ----------- | -------------- |\n`;

    for (const category of this.catalog.categories) {
      const description = category.description.length > 100
        ? `${category.description.substring(0, 97)}...`
        : category.description;

      result += `| ${category.name} | ${description} | ${category.endpoints.length} |\n`;

      // Include subcategories if present
      if (category.subcategories && category.subcategories.length > 0) {
        for (const subcategory of category.subcategories) {
          result += `| ${category.name} > ${subcategory.name} | ${subcategory.description.substring(0, 97)}... | ${subcategory.endpoints.length} |\n`;
        }
      }
    }

    return result;
  }

  async execute(params: ExploreCatalogParams): Promise<string> {
    logger.debug('Executing explore-sp-api-catalog tool with params:', params);

    // Handle reference extraction first
    if (params.ref && params.endpoint) {
      return this.extractReference(params.endpoint, params.ref, params);
    }

    if (params.endpoint) {
      const result = this.getEndpointDetails(params.endpoint, params.depth);
      return this.checkResponseSize(result, params);
    } else if (params.category) {
      return this.getCategoryDetails(params.category);
    } else if (params.listEndpoints) {
      return this.listAllEndpoints();
    } else if (params.listCategories) {
      return this.listAllCategories();
    } else {
      return this.getCatalogOverview();
    }
  }
  /**
   * Check response size and return truncation message with enhanced metadata
   */
  private checkResponseSize(result: string, params: ExploreCatalogParams): string {
    const estimatedTokens = Math.ceil(result.length / 4); // Rough token estimation
    const currentDepth = params.depth || "full";

    if (estimatedTokens > config.maxTokens) {
      // Analyze truncated fields for better suggestions
      const truncatedFields = this.analyzeTruncatedFields(result);
      
      return JSON.stringify({
        endpoint: params.endpoint,
        status: "truncated",
        reason: `Response size (${estimatedTokens.toLocaleString()} tokens) exceeds limit (${config.maxTokens.toLocaleString()} tokens)`,
        metadata: {
          truncatedFields: truncatedFields,
          currentDepth: currentDepth,
          suggestedActions: this.generateActionableSuggestions(params, truncatedFields)
        },
        suggestions: {
          progressive_exploration: [
            currentDepth === "full" ? "Try depth: 1 for overview" : `Try depth: ${Math.max(0, Number(currentDepth) - 1)} for less detail`,
            currentDepth === "full" ? "Try depth: 2 for moderate detail" : `Try depth: ${Number(currentDepth) + 1} for more detail`,
            "Try depth: 'full' for complete expansion (may still truncate)"
          ],
          targeted_investigation: [
            "Use ref: 'properties.payload' for main response data",
            "Use ref: 'properties.errors' for error structure",
            ...this.generateRefSuggestions(params.endpoint || "")
          ]
        },
        schema: "[TRUNCATED - Use suggested approaches above]"
      }, null, 2);
    }

    return this.addResponseMetadata(result, params);
  }

  /**
   * Add metadata to non-truncated responses
   */
  private addResponseMetadata(result: string, params: ExploreCatalogParams): string {
    // For JSON responses, add metadata
    if (result.startsWith('{') || result.startsWith('[')) {
      try {
        const parsed = JSON.parse(result);
        if (parsed.schema || parsed.ref) {
          // This is already a structured response, add metadata
          parsed.metadata = {
            responseComplete: true,
            currentDepth: params.depth || "full",
            suggestions: this.generateActionableSuggestions(params, [])
          };
          return JSON.stringify(parsed, null, 2);
        }
      } catch (e) {
        // Not JSON, return as-is
      }
    }
    return result;
  }

  /**
   * Analyze result to find truncated fields
   */
  private analyzeTruncatedFields(result: string): string[] {
    const truncatedFields: string[] = [];
    const patterns = [
      /\[Object: \d+ properties\] - Use greater depth/g,
      /\[Array\] - Use greater depth/g,
      /"\[Object: \d+ properties\] - Use greater depth or ref parameter to expand"/g
    ];
    
    patterns.forEach(pattern => {
      const matches = result.match(pattern);
      if (matches) {
        truncatedFields.push(...matches);
      }
    });
    
    return [...new Set(truncatedFields)];
  }

  /**
   * Generate actionable suggestions based on context
   */
  private generateActionableSuggestions(params: ExploreCatalogParams, truncatedFields: string[]): string[] {
    const suggestions: string[] = [];
    const currentDepth = params.depth || "full";
    
    if (truncatedFields.length > 0) {
      suggestions.push(`Found ${truncatedFields.length} truncated field(s) - try increasing depth`);
    }
    
    if (typeof currentDepth === 'number') {
      suggestions.push(`Current depth: ${currentDepth}, try depth: ${currentDepth + 2} or higher for more detail`);
      suggestions.push(`Try depth: 'full' for complete expansion`);
    } else if (currentDepth === 'full') {
      suggestions.push("Using 'full' depth - response may be truncated due to size limits");
      suggestions.push("Use 'ref' parameter to explore specific sections");
    }
    
    if (params.endpoint && !params.ref) {
      suggestions.push("Use 'ref' parameter to explore specific nested objects (e.g., 'properties.payload')");
    }
    
    return suggestions;
  }

  /**
   * Generate reference suggestions for specific endpoints
   */
  private generateRefSuggestions(endpointId: string): string[] {
    const suggestions: string[] = [];
    
    if (endpointId.includes('Order')) {
      suggestions.push(
        "Try: --ref Order.ShippingAddress for shipping details",
        "Try: --ref Order.BuyerInfo for buyer information",
        "Try: --ref Order.PaymentExecutionDetail for payment info"
      );
    } else if (endpointId.includes('Inventory')) {
      suggestions.push(
        "Try: --ref InventorySummary.TotalQuantity for quantities",
        "Try: --ref InventorySummary.Condition for item conditions"
      );
    } else {
      suggestions.push(
        "Try: --ref properties.payload for main data structure",
        "Try: --ref properties.errors for error definitions"
      );
    }
    
    return suggestions;
  }

  /**
   * Navigate schema object using dot notation path
   */
  private navigateSchemaPath(schema: any, path: string): any {
    const parts = path.split('.');
    let current = schema;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null; // Path not found
      }
    }
    return current;
  }

  /**
   * Extract specific nested object reference
   */
  private extractReference(endpointId: string, refPath: string, params: ExploreCatalogParams): string {
    // Find the endpoint
    let endpoint: ApiEndpoint | undefined;
    
    for (const category of this.catalog.categories) {
      const found = category.endpoints.find(e => e.id === endpointId);
      if (found) {
        endpoint = found;
        break;
      }
    }

    if (!endpoint) {
      return `# Reference Not Found\n\nThe endpoint '${endpointId}' was not found in the catalog.`;
    }

    // Find the response schema (look for 200 response first, then any successful response)
    const successResponse = endpoint.responses.find(r => r.statusCode === 200) ||
                           endpoint.responses.find(r => r.statusCode >= 200 && r.statusCode < 300);
    
    if (!successResponse || !successResponse.schema) {
      return JSON.stringify({
        ref: refPath,
        endpoint: endpointId,
        error: "No schema found for successful response",
        available_responses: endpoint.responses.map(r => ({
          status: r.statusCode,
          has_schema: !!r.schema
        }))
      }, null, 2);
    }

    // Navigate to the specific path
    const extractedSchema = this.navigateSchemaPath(successResponse.schema, refPath);
    
    if (extractedSchema === null) {
      return JSON.stringify({
        ref: refPath,
        endpoint: endpointId,
        error: `Path '${refPath}' not found in schema`,
        suggestions: this.generatePathSuggestions(successResponse.schema, refPath),
        navigation_context: this.analyzeCurrentLocation(successResponse.schema, '')
      }, null, 2);
    }

    // Apply existing depth limiting and return formatted result with metadata
    const limitedSchema = this.limitSchemaDepth(extractedSchema, params.depth || "full");
    return JSON.stringify({
      ref: refPath,
      endpoint: endpointId,
      path_found: true,
      schema: limitedSchema,
      navigation_context: this.analyzeCurrentLocation(extractedSchema, refPath),
      metadata: {
        depth_applied: params.depth || "full",
        schema_truncated: JSON.stringify(limitedSchema).includes('[Object:') || JSON.stringify(limitedSchema).includes('[Array]'),
        suggestions: this.generateActionableSuggestions(params, [])
      }
    }, null, 2);
  }

  /**
   * Analyze current schema location and provide navigation context
   */
  private analyzeCurrentLocation(schema: any, currentPath: string): object {
    if (!schema || typeof schema !== 'object') {
      return { available_next_steps: [] };
    }

    const context: any = {
      schema_type: schema.type || 'unknown',
      available_next_steps: []
    };

    // Analyze what's directly available at current level
    if (schema.properties) {
      const fields = Object.keys(schema.properties);
      context.available_next_steps = fields.map(field => 
        `${currentPath ? currentPath + '.' : ''}properties.${field}`
      );
    }
    
    if (schema.items) {
      context.available_next_steps.push(`${currentPath ? currentPath + '.' : ''}items`);
    }

    return context;
  }

  /**
   * Generate path suggestions for invalid paths
   */
  private generatePathSuggestions(schema: any, attemptedPath: string): string[] {
    const suggestions: string[] = [];
    const pathParts = attemptedPath.split('.');
    const firstPart = pathParts[0];
    
    // Find similar top-level keys
    if (schema && typeof schema === 'object') {
      const availableKeys = Object.keys(schema);
      
      // Exact matches at top level
      const exactMatches = availableKeys.filter(key => 
        key.toLowerCase() === firstPart.toLowerCase()
      );
      
      // Partial matches at top level
      const partialMatches = availableKeys.filter(key =>
        key.toLowerCase().includes(firstPart.toLowerCase()) ||
        firstPart.toLowerCase().includes(key.toLowerCase())
      );
      
      suggestions.push(...exactMatches);
      suggestions.push(...partialMatches.filter(m => !exactMatches.includes(m)));
      
      // If we have too few suggestions, add all available top-level keys
      if (suggestions.length < 3) {
        suggestions.push(...availableKeys.slice(0, 5 - suggestions.length));
      }
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Apply depth limiting to schema object with enhanced truncation messages
   */
  private limitSchemaDepth(schema: any, maxDepth: number | "full", currentDepth: number = 0): any {
    if (maxDepth === "full") {
      return schema;
    }

    if (currentDepth >= maxDepth) {
      if (typeof schema === 'object' && schema !== null) {
        if (Array.isArray(schema)) {
          return "[Array] - Use greater depth to expand";
        } else {
          const keys = Object.keys(schema);
          if (keys.length > 0) {
            // Enhanced truncation message with field hints
            const fieldHints = keys.slice(0, 3).join(', ') + (keys.length > 3 ? ', ...' : '');
            return `[Object: ${keys.length} properties (${fieldHints})] - Use greater depth or ref parameter to expand`;
          }
        }
      }
      return schema;
    }

    if (typeof schema === 'object' && schema !== null) {
      if (Array.isArray(schema)) {
        return schema.map(item => this.limitSchemaDepth(item, maxDepth, currentDepth + 1));
      } else {
        const result: any = {};
        for (const [key, value] of Object.entries(schema)) {
          result[key] = this.limitSchemaDepth(value, maxDepth, currentDepth + 1);
        }
        return result;
      }
    }

    return schema;
  }

  /**
   * Get detailed information about a specific endpoint
   */
  private getEndpointDetails(endpointId: string, depth: number | "full" = "full"): string {
    // Find the endpoint
    let endpoint: ApiEndpoint | undefined;
    let categoryName = '';

    for (const category of this.catalog.categories) {
      const found = category.endpoints.find(e => e.id === endpointId);
      if (found) {
        endpoint = found;
        categoryName = category.name;
        break;
      }
    }

    if (!endpoint) {
      return `# Endpoint Not Found\n\nThe endpoint '${endpointId}' was not found in the catalog. Please check the endpoint ID and try again.`;
    }

    // Format endpoint details
    let result = `# Endpoint: ${endpoint.name}\n\n`;
    result += `**ID**: \`${endpoint.id}\`\n`;
    result += `**Category**: ${categoryName}\n`;
    result += `**Method**: ${endpoint.method}\n`;
    result += `**Path**: \`${endpoint.path}\`\n\n`;

    // Description and purpose
    result += `## Description\n${endpoint.description}\n\n`;
    result += `## Purpose\n${endpoint.purpose}\n\n`;

    // Common use cases
    if (endpoint.commonUseCases.length > 0) {
      result += `## Common Use Cases\n`;
      for (const useCase of endpoint.commonUseCases) {
        result += `- ${useCase}\n`;
      }
      result += '\n';
    }

    // Parameters
    if (endpoint.parameters.length > 0) {
      result += `## Parameters\n`;

      // Group by location
      const pathParams = endpoint.parameters.filter(p => p.location === 'path');
      const queryParams = endpoint.parameters.filter(p => p.location === 'query');
      const bodyParams = endpoint.parameters.filter(p => p.location === 'body');
      const headerParams = endpoint.parameters.filter(p => p.location === 'header');

      // Path parameters
      if (pathParams.length > 0) {
        result += `### Path Parameters\n`;
        for (const param of pathParams) {
          const typeInfo = Array.isArray(param.type) ? param.type.join(' | ') : param.type;
          result += `- \`${param.name}\` (${param.required ? 'Required' : 'Optional'}, ${typeInfo}) - ${param.description}\n`;
        }
        result += '\n';
      }

      // Query parameters
      if (queryParams.length > 0) {
        result += `### Query Parameters\n`;
        for (const param of queryParams) {
          const typeInfo = Array.isArray(param.type) ? param.type.join(' | ') : param.type;
          result += `- \`${param.name}\` (${param.required ? 'Required' : 'Optional'}, ${typeInfo}) - ${param.description}\n`;
        }
        result += '\n';
      }

      // Body parameters
      if (bodyParams.length > 0) {
        result += `### Body Parameters\n`;
        for (const param of bodyParams) {
          const typeInfo = Array.isArray(param.type) ? param.type.join(' | ') : param.type;
          result += `- \`${param.name}\` (${param.required ? 'Required' : 'Optional'}, ${typeInfo}) - ${param.description}\n`;

          if (param.schema) {
            const limitedSchema = this.limitSchemaDepth(param.schema, depth);
            result += `  Schema: \`\`\`json\n${JSON.stringify(limitedSchema, null, 2)}\n\`\`\`\n`;
          }
        }
        result += '\n';
      }

      // Header parameters
      if (headerParams.length > 0) {
        result += `### Header Parameters\n`;
        for (const param of headerParams) {
          const typeInfo = Array.isArray(param.type) ? param.type.join(' | ') : param.type;
          result += `- \`${param.name}\` (${param.required ? 'Required' : 'Optional'}, ${typeInfo}) - ${param.description}\n`;
        }
        result += '\n';
      }
    }

    // Response information
    if (endpoint.responses.length > 0) {
      result += `## Responses\n`;
      for (const response of endpoint.responses) {
        result += `### Status ${response.statusCode}\n`;
        result += `${response.description}\n\n`;

        // Add headers if present
        if (response.headers && Object.keys(response.headers).length > 0) {
          result += `**Headers:**\n`;
          for (const [headerName, headerInfo] of Object.entries(response.headers)) {
            result += `- \`${headerName}\`: ${headerInfo.type} - ${headerInfo.description}\n`;
          }
          result += `\n`;
        }

        if (response.schema && Object.keys(response.schema).length > 0) {
          const limitedSchema = this.limitSchemaDepth(response.schema, depth);
          result += `Response Schema: \`\`\`json\n${JSON.stringify(limitedSchema, null, 2)}\n\`\`\`\n\n`;
        }
      }
    }

    // Related endpoints
    if (endpoint.relatedEndpoints.length > 0) {
      result += `## Related Endpoints\n`;
      for (const related of endpoint.relatedEndpoints) {
        result += `- \`${related.id}\` - ${related.relationship}\n`;
      }
      result += '\n';
    }

    // Version information
    result += `## Version Information\n`;
    result += `- Current Version: ${endpoint.version.current}\n`;
    if (endpoint.version.deprecated.length > 0) {
      result += `- Deprecated Versions: ${endpoint.version.deprecated.join(', ')}\n`;
    }
    if (endpoint.version.beta.length > 0) {
      result += `- Beta Versions: ${endpoint.version.beta.join(', ')}\n`;
    }

    return result;
  }

  /**
   * Get details about a specific category
   */
  private getCategoryDetails(categoryName: string): string {
    // Find the category (case-insensitive search)
    const category = this.catalog.categories.find(
      c => c.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (!category) {
      return `# Category Not Found\n\nThe category '${categoryName}' was not found in the catalog. Please check the category name and try again.\n\n## Available Categories\n${this.listCategories()}`;
    }

    // Format category details
    let result = `# Category: ${category.name}\n\n`;
    result += `${category.description}\n\n`;

    // List endpoints in this category
    result += `## Endpoints (${category.endpoints.length})\n\n`;

    if (category.endpoints.length > 0) {
      result += `| Endpoint ID | Name | Method | Description |\n`;
      result += `| ----------- | ---- | ------ | ----------- |\n`;

      for (const endpoint of category.endpoints) {
        // Truncate description if too long
        const description = endpoint.description.length > 100
          ? `${endpoint.description.substring(0, 97)}...`
          : endpoint.description;

        result += `| \`${endpoint.id}\` | ${endpoint.name} | ${endpoint.method} | ${description} |\n`;
      }
    } else {
      result += `No endpoints found in this category.\n`;
    }

    // Subcategories if any
    if (category.subcategories && category.subcategories.length > 0) {
      result += `\n## Subcategories\n\n`;

      for (const subcategory of category.subcategories) {
        result += `### ${subcategory.name}\n`;
        result += `${subcategory.description}\n\n`;

        // List endpoints in this subcategory
        if (subcategory.endpoints.length > 0) {
          result += `| Endpoint ID | Name | Method | Description |\n`;
          result += `| ----------- | ---- | ------ | ----------- |\n`;

          for (const endpoint of subcategory.endpoints) {
            const description = endpoint.description.length > 100
              ? `${endpoint.description.substring(0, 97)}...`
              : endpoint.description;

            result += `| \`${endpoint.id}\` | ${endpoint.name} | ${endpoint.method} | ${description} |\n`;
          }
        } else {
          result += `No endpoints found in this subcategory.\n`;
        }
      }
    }

    return result;
  }

  /**
   * List all endpoints in the catalog
   */
  private listAllEndpoints(): string {
    let result = `# All SP-API Endpoints\n\n`;

    // Count total endpoints
    let totalEndpoints = 0;
    for (const category of this.catalog.categories) {
      totalEndpoints += category.endpoints.length;
    }

    result += `Total endpoints: ${totalEndpoints}\n\n`;

    // Group by category
    for (const category of this.catalog.categories) {
      result += `## ${category.name} (${category.endpoints.length})\n\n`;

      if (category.endpoints.length > 0) {
        result += `| Endpoint ID | Name | Method | Path |\n`;
        result += `| ----------- | ---- | ------ | ---- |\n`;

        for (const endpoint of category.endpoints) {
          result += `| \`${endpoint.id}\` | ${endpoint.name} | ${endpoint.method} | \`${endpoint.path}\` |\n`;
        }

        result += '\n';
      } else {
        result += `No endpoints found in this category.\n\n`;
      }
    }

    return result;
  }

  /**
   * Get an overview of the entire catalog
   */
  private getCatalogOverview(): string {
    let result = `# Amazon SP-API Catalog Overview\n\n`;

    // Count total endpoints
    let totalEndpoints = 0;
    for (const category of this.catalog.categories) {
      totalEndpoints += category.endpoints.length;
    }

    result += `The Amazon Selling Partner API (SP-API) provides a suite of APIs for managing your Amazon seller account programmatically. `;
    result += `This catalog contains ${this.catalog.categories.length} categories with a total of ${totalEndpoints} endpoints.\n\n`;

    // List categories
    result += `## Categories\n\n`;
    result += this.listCategories();

    // Usage instructions
    result += `\n## How to Explore the Catalog\n\n`;
    result += `You can explore the SP-API catalog using the following options:\n\n`;
    result += `1. **Get category details**: Use \`explore-sp-api-catalog\` with the \`category\` parameter to view all endpoints in a specific category\n`;
    result += `2. **Get endpoint details**: Use \`explore-sp-api-catalog\` with the \`endpoint\` parameter to get detailed information about a specific endpoint\n`;
    result += `3. **List all endpoints**: Use \`explore-sp-api-catalog\` with \`listEndpoints: true\` to see all available endpoints\n\n`;

    result += `## Example Usage\n\n`;
    result += `To explore a category:\n`;
    result += `\`\`\`json\n{"category": "FBA Inventory"}\n\`\`\`\n\n`;

    result += `To get endpoint details:\n`;
    result += `\`\`\`json\n{"endpoint": "getInventorySummaries"}\n\`\`\`\n\n`;

    result += `To list all endpoints:\n`;
    result += `\`\`\`json\n{"listEndpoints": true}\n\`\`\`\n`;

    return result;
  }

  /**
   * Helper to list categories
   */
  private listCategories(): string {
    let result = `| Category | Description | Endpoints |\n`;
    result += `| -------- | ----------- | --------- |\n`;

    for (const category of this.catalog.categories) {
      // Truncate description if too long
      const description = category.description.length > 100
        ? `${category.description.substring(0, 97)}...`
        : category.description;

      result += `| ${category.name} | ${description} | ${category.endpoints.length} |\n`;
    }

    return result;
  }
}