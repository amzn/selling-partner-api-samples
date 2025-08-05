// src/tools/explore-catalog-tool.ts

import { z } from 'zod';
import { ApiCatalog, ApiEndpoint, ApiCategory } from '../types/api-catalog.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export const exploreCatalogSchema = z.object({
  endpoint: z.string().optional().describe("Specific endpoint to get details for"),
  category: z.string().optional().describe("Category to explore"),
  listEndpoints: z.boolean().optional().default(false).describe("List all available endpoints"),
  listCategories: z.boolean().optional().default(false).describe("List all available categories"),
  depth: z.union([z.number().min(0), z.literal("full")]).optional().default("full").describe("Control nested object expansion depth. Use a number (0, 1, 2, etc.) for specific depth levels, or the string 'full' for complete expansion. Examples: 1 (number), 2 (number), or 'full' (string)"),
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
      return this.extractReference(params.endpoint, params.ref);
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
   * Check response size and return truncation message if needed
   */
  private checkResponseSize(result: string, params: ExploreCatalogParams): string {
    const estimatedTokens = Math.ceil(result.length / 4); // Rough token estimation

    if (estimatedTokens > config.maxTokens && params.depth === "full") {
      return JSON.stringify({
        endpoint: params.endpoint,
        status: "truncated",
        reason: `Response size (${estimatedTokens.toLocaleString()} tokens) exceeds limit (${config.maxTokens.toLocaleString()} tokens)`,
        suggestions: {
          progressive_exploration: [
            `Try: --depth 1 for overview`,
            `Try: --depth 2 for moderate detail`
          ],
          targeted_investigation: [
            `Try: --ref Order.ShippingAddress for specific object`,
            `Try: --ref Order.BuyerInfo for buyer details`,
            `Try: --ref Order.OrderItems for item details`
          ]
        },
        schema: "[TRUNCATED - Use suggested approaches above]"
      }, null, 2);
    }

    return result;
  }

  /**
   * Extract specific nested object reference
   */
  private extractReference(endpointId: string, refPath: string): string {
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

    // For now, return a placeholder - full implementation would navigate the schema
    return JSON.stringify({
      ref: refPath,
      endpoint: endpointId,
      schema: `[Placeholder for ${refPath} extraction - Full implementation would navigate response schema]`
    }, null, 2);
  }

  /**
   * Apply depth limiting to schema object
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
            return `[Object: ${keys.length} properties] - Use greater depth or ref parameter to expand`;
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
          result += `- \`${param.name}\` (${param.required ? 'Required' : 'Optional'}) - ${param.description}\n`;
        }
        result += '\n';
      }

      // Query parameters
      if (queryParams.length > 0) {
        result += `### Query Parameters\n`;
        for (const param of queryParams) {
          result += `- \`${param.name}\` (${param.required ? 'Required' : 'Optional'}) - ${param.description}\n`;
        }
        result += '\n';
      }

      // Body parameters
      if (bodyParams.length > 0) {
        result += `### Body Parameters\n`;
        for (const param of bodyParams) {
          result += `- \`${param.name}\` (${param.required ? 'Required' : 'Optional'}) - ${param.description}\n`;

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
          result += `- \`${param.name}\` (${param.required ? 'Required' : 'Optional'}) - ${param.description}\n`;
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