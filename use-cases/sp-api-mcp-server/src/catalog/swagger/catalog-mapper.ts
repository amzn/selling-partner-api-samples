// src/catalog/swagger/catalog-mapper.ts

import { ApiCatalog, ApiCategory, ApiEndpoint, ApiParameter, ApiResponse, RelatedEndpoint, VersionInfo, UsageExample, IntentMapping } from '../../types/api-catalog.js';
import { ProcessedSwaggerDocument, Operation } from '../../types/swagger-types.js';
import { logger } from '../../utils/logger.js';

export class CatalogMapper {
  /**
   * Map processed Swagger documents to a unified API catalog
   */
  mapSwaggerToCatalog(swaggerMap: Map<string, ProcessedSwaggerDocument>): ApiCatalog {
    logger.info(`Mapping ${swaggerMap.size} Swagger documents to API catalog`);
    
    const catalog: ApiCatalog = {
      categories: [],
      intentMappings: []
    };
    
    // Process each Swagger document
    for (const [filePath, swagger] of swaggerMap.entries()) {
      try {
        logger.debug(`Mapping Swagger document from: ${filePath}`);
        
        // Extract category from API title
        const categoryName = this.extractCategoryName(swagger.info.title);
        
        // Find or create category
        let category = catalog.categories.find(c => c.name === categoryName);
        if (!category) {
          category = {
            name: categoryName,
            description: swagger.info.description || `APIs for ${categoryName}`,
            endpoints: []
          };
          catalog.categories.push(category);
        }
        
        // Process paths and operations
        this.processSwaggerPaths(swagger, category);
        
      } catch (error) {
        logger.error(`Error mapping Swagger document from ${filePath}:`, error);
      }
    }
    
    // Generate intent mappings
    catalog.intentMappings = this.generateIntentMappings(catalog.categories);
    
    // Sort categories alphabetically
    catalog.categories.sort((a, b) => a.name.localeCompare(b.name));
    
    logger.info(`API catalog mapping complete with ${catalog.categories.length} categories`);
    return catalog;
  }
  
  /**
   * Extract a category name from the API title
   */
  private extractCategoryName(title: string): string {
    // Extract from "Selling Partner API for X" pattern
    const match = title.match(/Selling Partner API for (.+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // If no match, use the title as is
    return title;
  }
  
  /**
   * Generate a category prefix for unique endpoint IDs
   */
  private getCategoryPrefix(title: string): string {
    const categoryName = this.extractCategoryName(title);
    
    // Convert to camelCase and remove spaces/special characters
    return categoryName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .split(/\s+/) // Split on whitespace
      .map((word, index) => {
        if (index === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join('');
  }
  
  /**
   * Process paths and operations from a Swagger document
   */
  private processSwaggerPaths(swagger: ProcessedSwaggerDocument, category: ApiCategory): void {
    if (!swagger.paths) return;
    
    for (const [path, pathItem] of Object.entries(swagger.paths)) {
      // Process each operation (HTTP method)
      for (const method of ['get', 'post', 'put', 'delete', 'options', 'head', 'patch']) {
        const operation = pathItem[method as keyof typeof pathItem];
        if (operation) {
          // Map operation to endpoint
          const endpoint = this.mapOperationToEndpoint(
            path, 
            method.toUpperCase(), 
            operation as Operation, 
            swagger
          );
          
          // Add to category
          category.endpoints.push(endpoint);
        }
      }
    }
  }
  
  /**
   * Map a Swagger operation to an API endpoint
   */
  private mapOperationToEndpoint(
    path: string, 
    method: string, 
    operation: Operation, 
    swagger: ProcessedSwaggerDocument
  ): ApiEndpoint {
    const originalOperationId = operation.operationId || this.generateOperationId(path, method);
    const categoryPrefix = this.getCategoryPrefix(swagger.info.title);
    const uniqueId = `${categoryPrefix}_${originalOperationId}`;
    
    return {
      id: uniqueId,
      originalOperationId,
      name: operation.summary || originalOperationId,
      path,
      method,
      description: operation.description || '',
      purpose: this.generatePurpose(operation),
      commonUseCases: this.generateCommonUseCases(operation),
      parameters: this.mapParameters(operation, swagger),
      responses: this.mapResponses(operation),
      relatedEndpoints: this.findRelatedEndpoints(operation, swagger),
      version: this.extractVersionInfo(swagger),
      examples: this.extractExamples(operation, swagger)
    };
  }
  
  /**
   * Generate an operation ID from path and method
   */
  private generateOperationId(path: string, method: string): string {
    // Remove leading slash and replace path parameters
    const cleanPath = path.substring(1).replace(/\{([^}]+)\}/g, '$1');
    
    // Convert to camelCase
    const parts = cleanPath.split('/');
    const camelParts = parts.map((part, index) => {
      if (index === 0) return part.toLowerCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    });
    
    // Combine method and path
    const methodPrefix = method.toLowerCase();
    return `${methodPrefix}${camelParts.join('')}`;
  }
  
  /**
   * Generate a purpose description for an operation
   */
  private generatePurpose(operation: Operation): string {
    if (operation.description) {
      // Try to extract the first sentence
      const match = operation.description.match(/^([^.!?]+[.!?])/);
      if (match) {
        return match[1].trim();
      }
      
      // If no clear sentence, use the first 100 chars
      if (operation.description.length > 100) {
        return `${operation.description.substring(0, 97)}...`;
      }
      
      return operation.description;
    }
    
    if (operation.summary) {
      return operation.summary;
    }
    
    // Generate generic purpose based on method
    const method = (operation as any)._method || 'UNKNOWN';
    switch (method) {
      case 'GET': return 'Retrieve information from Amazon SP-API.';
      case 'POST': return 'Create or submit data to Amazon SP-API.';
      case 'PUT': return 'Update existing data in Amazon SP-API.';
      case 'DELETE': return 'Remove data from Amazon SP-API.';
      default: return 'Interact with Amazon SP-API.';
    }
  }
  
  /**
   * Generate common use cases from operation description
   */
  private generateCommonUseCases(operation: Operation): string[] {
    const useCases: string[] = [];
    
    if (operation.description) {
      // Extract sentences containing "use", "allows", "enables", etc.
      const description = operation.description.toLowerCase();
      const sentences = description.split(/[.!?]+/).map(s => s.trim()).filter(s => s);
      
      for (const sentence of sentences) {
        if (
          sentence.includes('use this to') ||
          sentence.includes('allows you to') ||
          sentence.includes('enables you to') ||
          sentence.includes('can be used to') ||
          sentence.includes('use case') ||
          sentence.includes('useful for')
        ) {
          // Capitalize first letter and add period
          const formatted = sentence.charAt(0).toUpperCase() + sentence.slice(1);
          useCases.push(formatted.endsWith('.') ? formatted : `${formatted}.`);
        }
      }
    }
    
    // If no use cases found, generate based on method
    if (useCases.length === 0) {
      const method = (operation as any)._method || 'UNKNOWN';
      const resource = this.extractResourceFromPath((operation as any)._path || '');
      
      switch (method) {
        case 'GET':
          useCases.push(`Retrieve ${resource} information.`);
          if (operation.operationId?.includes('list') || operation.operationId?.includes('search')) {
            useCases.push(`Find specific ${resource} that match certain criteria.`);
          }
          break;
        case 'POST':
          useCases.push(`Create new ${resource} in Amazon's system.`);
          if (operation.operationId?.includes('submit') || operation.operationId?.includes('send')) {
            useCases.push(`Submit ${resource} data to Amazon for processing.`);
          }
          break;
        case 'PUT':
          useCases.push(`Update existing ${resource} information.`);
          break;
        case 'DELETE':
          useCases.push(`Remove ${resource} from Amazon's system.`);
          break;
      }
    }
    
    return useCases;
  }
  
  /**
   * Extract resource name from path
   */
  private extractResourceFromPath(path: string): string {
    if (!path) return 'resources';
    
    // Extract the main resource from the path
    const parts = path.split('/').filter(p => p && !p.includes('{'));
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      // Make it singular if it ends with 's'
      if (lastPart.endsWith('s') && lastPart.length > 1) {
        return lastPart.substring(0, lastPart.length - 1);
      }
      return lastPart;
    }
    
    return 'resources';
  }
  
  /**
   * Map operation parameters to API parameters
   */
  private mapParameters(operation: Operation, swagger: ProcessedSwaggerDocument): ApiParameter[] {
    const parameters: ApiParameter[] = [];
    
    // Process path and query parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        parameters.push({
          name: param.name,
          location: param.in as 'path' | 'query' | 'body' | 'header',
          required: param.required || false,
          type: param.type || (param.schema?.type) || 'string',
          description: param.description || '',
          purpose: this.generateParameterPurpose(param),
          schema: param.schema
        });
      }
    }
    
    // Process request body for OpenAPI 3.x
    if (operation.requestBody) {
      const contentType = operation.requestBody.content?.['application/json'];
      if (contentType && contentType.schema) {
        parameters.push({
          name: 'body',
          location: 'body',
          required: operation.requestBody.required || false,
          type: 'object',
          description: operation.requestBody.description || 'Request body',
          purpose: 'Contains the data to send in the request body',
          schema: contentType.schema
        });
      }
    }
    
    return parameters;
  }
  
  /**
   * Generate a purpose description for a parameter
   */
  private generateParameterPurpose(param: any): string {
    if (param.description) {
      // Try to extract the first sentence
      const match = param.description.match(/^([^.!?]+[.!?])/);
      if (match) {
        return match[1].trim();
      }
      
      return param.description;
    }
    
    // Generate generic purpose based on parameter location
    switch (param.in) {
      case 'path':
        return `Identifies the specific ${param.name} in the request path.`;
      case 'query':
        return `Filters or customizes the request results.`;
      case 'header':
        return `Provides additional context for the request.`;
      case 'body':
        return `Contains the data to be processed.`;
      default:
        return `Specifies the ${param.name} for this operation.`;
    }
  }
  
  /**
   * Map operation responses to API responses
   */
  private mapResponses(operation: Operation): ApiResponse[] {
    const responses: ApiResponse[] = [];
    
    if (operation.responses) {
      for (const [code, response] of Object.entries(operation.responses)) {
        // Handle Swagger 2.0 and OpenAPI 3.x schemas
        let schema = response.schema;
        if (!schema && response.content?.['application/json']?.schema) {
          schema = response.content['application/json'].schema;
        }
        
        responses.push({
          statusCode: parseInt(code, 10) || 0,
          description: response.description,
          schema
        });
      }
    }
    
    return responses;
  }
  
  /**
   * Find related endpoints based on tags and path pattern
   */
  private findRelatedEndpoints(operation: Operation, swagger: ProcessedSwaggerDocument): RelatedEndpoint[] {
    const related: RelatedEndpoint[] = [];
    const currentOpId = operation.operationId;
    
    if (!currentOpId || !swagger.paths) return related;
    
    // Group operations by tag
    const currentTags = operation.tags || [];
    const currentPath = (operation as any)._path || '';
    const resourcePath = this.getResourcePath(currentPath);
    
    // Find related endpoints by tag and path pattern
    for (const [path, pathItem] of Object.entries(swagger.paths)) {
      for (const method of ['get', 'post', 'put', 'delete']) {
        const op = pathItem[method as keyof typeof pathItem] as Operation;
        if (!op || op.operationId === currentOpId) continue;
        
        // Check if operations share tags
        const opTags = op.tags || [];
        const sharedTags = currentTags.filter(tag => opTags.includes(tag));
        
        // Check if operations are on the same resource
        const opPath = path;
        const opResourcePath = this.getResourcePath(opPath);
        const sameResource = resourcePath && opResourcePath && resourcePath === opResourcePath;
        
        if ((sharedTags.length > 0 || sameResource) && op.operationId) {
          // Determine relationship
          let relationship = '';
          
          if (sameResource) {
            // Generate relationship based on methods
            const currentMethod = (operation as any)._method || '';
            const opMethod = method.toUpperCase();
            
            if (currentMethod === 'GET' && opMethod === 'POST') {
              relationship = `Create a new ${this.extractResourceFromPath(resourcePath)}`;
            } else if (currentMethod === 'GET' && opMethod === 'PUT') {
              relationship = `Update the ${this.extractResourceFromPath(resourcePath)} information`;
            } else if (currentMethod === 'GET' && opMethod === 'DELETE') {
              relationship = `Delete the ${this.extractResourceFromPath(resourcePath)}`;
            } else if (currentMethod === 'POST' && opMethod === 'GET') {
              relationship = `Retrieve the created ${this.extractResourceFromPath(resourcePath)}`;
            } else {
              relationship = `Another operation on the same ${this.extractResourceFromPath(resourcePath)} resource`;
            }
          } else if (sharedTags.length > 0) {
            relationship = `Related to the same functionality (${sharedTags.join(', ')})`;
          }
          
          related.push({
            id: op.operationId,
            relationship
          });
        }
      }
    }
    
    return related;
  }
  
  /**
   * Extract the resource path (without IDs) from a full path
   */
  private getResourcePath(path: string): string {
    if (!path) return '';
    
    // Replace path parameters with placeholders
    return path.replace(/\/\{[^}]+\}/g, '/{id}');
  }
  
  /**
   * Extract version information from a Swagger document
   */
  private extractVersionInfo(swagger: ProcessedSwaggerDocument): VersionInfo {
    return {
      current: swagger.info.version,
      deprecated: [],  // We don't have this info in the Swagger docs
      beta: [],        // We don't have this info in the Swagger docs
      changes: []      // We don't have this info in the Swagger docs
    };
  }
  
  /**
   * Extract examples from a Swagger operation
   */
  private extractExamples(operation: Operation, swagger: ProcessedSwaggerDocument): UsageExample[] {
    const examples: UsageExample[] = [];
    
    // Try to extract examples from OpenAPI x-amzn-api-sandbox field
    const xAmznApiSandbox = (operation as any)['x-amzn-api-sandbox'];
    if (xAmznApiSandbox && Array.isArray(xAmznApiSandbox.static)) {
      for (const example of xAmznApiSandbox.static) {
        if (example.request && example.response) {
          examples.push({
            scenario: `Example ${examples.length + 1}`,
            request: example.request,
            response: example.response
          });
        }
      }
    }
    
    // Check if there are OpenAPI 3.x examples
    if (operation.requestBody?.content?.['application/json']?.examples) {
      const openApiExamples = operation.requestBody.content['application/json'].examples;
      
      // This fixes the TypeScript error
      if (openApiExamples && typeof openApiExamples === 'object') {
        for (const [name, example] of Object.entries(openApiExamples)) {
          if (example && typeof example === 'object' && 'value' in example) {
            examples.push({
              scenario: name,
              request: example.value,
              response: this.findMatchingResponse(example.value, operation)
            });
          }
        }
      }
    }
    
    return examples;
  }
  
  /**
   * Find a matching response for a request example
   */
  private findMatchingResponse(requestExample: any, operation: Operation): any {
    // For now, just return a generic success response
    const successResponse = operation.responses?.['200'] || operation.responses?.['201'];
    if (successResponse) {
      if (successResponse.schema) {
        return { schema: successResponse.schema };
      }
      
      if (successResponse.content?.['application/json']?.schema) {
        return { schema: successResponse.content['application/json'].schema };
      }
    }
    
    return { message: 'Successful response' };
  }
  
  /**
   * Generate intent mappings from API categories and endpoints
   */
  private generateIntentMappings(categories: ApiCategory[]): IntentMapping[] {
    const intentMappings: IntentMapping[] = [];
    
    // Generate intent mappings for each endpoint
    for (const category of categories) {
      for (const endpoint of category.endpoints) {
        // Generate primary intent from purpose
        const primaryIntent = this.generatePrimaryIntent(endpoint, category.name);
        intentMappings.push({
          intent: primaryIntent,
          relevantEndpoints: {
            primary: endpoint.id,
            primaryReason: `This endpoint directly addresses your intent to ${primaryIntent}`
          }
        });
        
        // Generate intents from common use cases
        for (const useCase of endpoint.commonUseCases) {
          const useCaseIntent = this.formatAsIntent(useCase);
          if (useCaseIntent && !this.intentExists(intentMappings, useCaseIntent)) {
            intentMappings.push({
              intent: useCaseIntent,
              relevantEndpoints: {
                primary: endpoint.id,
                primaryReason: `This endpoint is designed for this specific use case`
              }
            });
          }
        }
        
        // Generate operation-specific intents
        this.addOperationSpecificIntents(endpoint, category.name, intentMappings);
      }
    }
    
    return intentMappings;
  }
  
  /**
   * Generate a primary intent from endpoint purpose
   */
  private generatePrimaryIntent(endpoint: ApiEndpoint, categoryName: string): string {
    // Extract the main action from purpose or ID
    let action = '';
    if (endpoint.purpose) {
      action = endpoint.purpose.toLowerCase();
    } else if (endpoint.id) {
      // Extract verb from ID (e.g., getInventory -> get inventory)
      const match = endpoint.id.match(/^([a-z]+)([A-Z].*)/);
      if (match) {
        const verb = match[1];
        const resource = match[2]
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .toLowerCase();
        action = `${verb} ${resource}`;
      } else {
        action = endpoint.id;
      }
    }
    
    // Clean up and format as intent
    return this.formatAsIntent(action);
  }
  
  /**
   * Format a string as an intent
   */
  private formatAsIntent(text: string): string {
    if (!text) return '';
    
    // Remove periods and normalize whitespace
    let intent = text.replace(/\.$/, '').trim().toLowerCase();
    
    // Add "I want to" prefix if not present
    if (!intent.startsWith('i want to') && 
        !intent.startsWith('i need to') && 
        !intent.startsWith('i would like to')) {
      intent = `I want to ${intent}`;
    }
    
    return intent;
  }
  
 /**
   * Add operation-specific intents based on naming patterns
   */
 private addOperationSpecificIntents(
    endpoint: ApiEndpoint, 
    categoryName: string, 
    intentMappings: IntentMapping[]
  ): void {
    const id = endpoint.id.toLowerCase();
    const resourceName = this.extractResourceFromPath(endpoint.path);
    
    // Generate intents based on common operation patterns
    if (id.includes('get') || id.includes('list') || id.includes('search')) {
      const intentText = `I want to find ${resourceName} in my ${categoryName} account`;
      if (!this.intentExists(intentMappings, intentText)) {
        intentMappings.push({
          intent: intentText,
          relevantEndpoints: {
            primary: endpoint.id,
            primaryReason: `This endpoint retrieves ${resourceName} information`
          }
        });
      }
    }
    
    if (id.includes('create') || id.includes('add')) {
      const intentText = `I want to add a new ${resourceName} to my ${categoryName} account`;
      if (!this.intentExists(intentMappings, intentText)) {
        intentMappings.push({
          intent: intentText,
          relevantEndpoints: {
            primary: endpoint.id,
            primaryReason: `This endpoint creates new ${resourceName} entries`
          }
        });
      }
    }
    
    if (id.includes('update') || id.includes('edit')) {
      const intentText = `I want to update my ${resourceName} information`;
      if (!this.intentExists(intentMappings, intentText)) {
        intentMappings.push({
          intent: intentText,
          relevantEndpoints: {
            primary: endpoint.id,
            primaryReason: `This endpoint updates existing ${resourceName} data`
          }
        });
      }
    }
    
    if (id.includes('delete') || id.includes('remove')) {
      const intentText = `I want to remove a ${resourceName} from my account`;
      if (!this.intentExists(intentMappings, intentText)) {
        intentMappings.push({
          intent: intentText,
          relevantEndpoints: {
            primary: endpoint.id,
            primaryReason: `This endpoint deletes ${resourceName} entries`
          }
        });
      }
    }
    
    // Add category-specific intents
    if (categoryName.includes('Inventory')) {
      if (id.includes('inventory') || id.includes('stock')) {
        const intentText = `I want to check my current inventory levels`;
        if (!this.intentExists(intentMappings, intentText)) {
          intentMappings.push({
            intent: intentText,
            relevantEndpoints: {
              primary: endpoint.id,
              primaryReason: `This endpoint provides information about your inventory`
            }
          });
        }
      }
    }
    
    if (categoryName.includes('Orders')) {
      if (id.includes('order')) {
        const intentText = `I want to manage my Amazon orders`;
        if (!this.intentExists(intentMappings, intentText)) {
          intentMappings.push({
            intent: intentText,
            relevantEndpoints: {
              primary: endpoint.id,
              primaryReason: `This endpoint helps you work with orders`
            }
          });
        }
      }
    }
  }
  
  /**
   * Check if an intent already exists in the mappings
   */
  private intentExists(intentMappings: IntentMapping[], intent: string): boolean {
    return intentMappings.some(mapping => 
      mapping.intent.toLowerCase() === intent.toLowerCase()
    );
  }
}