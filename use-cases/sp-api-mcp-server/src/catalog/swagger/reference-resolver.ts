// src/catalog/swagger/reference-resolver.ts

import { logger } from '../../utils/logger.js';

/**
 * Handles resolution of JSON Schema $ref references in Swagger/OpenAPI documents
 */
export class SwaggerReferenceResolver {
  private definitions: Record<string, any> = {};
  private resolvedRefs: Map<string, any> = new Map(); // Cache resolved references
  
  constructor(private swagger: any) {
    // Extract definitions from different OpenAPI versions
    this.definitions = swagger.definitions || 
      (swagger.components ? swagger.components.schemas : {});
  }
  
  /**
   * Resolve all references in a schema object
   */
  resolveReferences(obj: any, context: string[] = [], depth: number = 0): any {
    // Prevent excessive recursion
    if (depth > 100) {
      logger.warn(`Maximum reference depth exceeded at context: ${context.join('/')}`);
      return { type: "object", description: "Maximum reference depth exceeded" };
    }
    
    if (!obj || typeof obj !== 'object') return obj;
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveReferences(item, context, depth + 1));
    }
    
    // Clone the object to avoid modifying original
    const resolved = { ...obj };
    
    // Handle special schema combiners that may contain refs
    if (obj.allOf || obj.anyOf || obj.oneOf) {
      this.handleSchemaCombiner(resolved, context, depth);
    }
    
    // Handle array items that may contain refs
    if (obj.type === 'array' && obj.items) {
      resolved.items = this.resolveReferences(obj.items, [...context, 'items'], depth + 1);
    }
    
    // Resolve $ref if present
    if (obj.$ref) {
      return this.resolveRef(obj.$ref, context, depth);
    }
    
    // Recursively resolve properties in object schemas
    if (obj.properties && typeof obj.properties === 'object') {
      resolved.properties = {};
      for (const [propName, propValue] of Object.entries(obj.properties)) {
        resolved.properties[propName] = this.resolveReferences(
          propValue, 
          [...context, 'properties', propName],
          depth + 1
        );
      }
    }
    
    // Resolve additionalProperties if it's an object (might contain $ref)
    if (obj.additionalProperties && typeof obj.additionalProperties === 'object') {
      resolved.additionalProperties = this.resolveReferences(
        obj.additionalProperties,
        [...context, 'additionalProperties'],
        depth + 1
      );
    }
    
    // Handle other common schema properties that might contain references
    this.resolveCommonSchemaProperties(resolved, context, depth);
    
    return resolved;
  }
  
  /**
   * Handle schema combiners (allOf, anyOf, oneOf)
   */
  private handleSchemaCombiner(resolved: any, context: string[], depth: number): void {
    for (const combiner of ['allOf', 'anyOf', 'oneOf']) {
      if (resolved[combiner] && Array.isArray(resolved[combiner])) {
        resolved[combiner] = resolved[combiner].map((schema: any, index: number) => 
          this.resolveReferences(
            schema, 
            [...context, combiner, index.toString()],
            depth + 1
          )
        );
      }
    }
  }
  
  /**
   * Resolve other common schema properties that might contain references
   */
  private resolveCommonSchemaProperties(resolved: any, context: string[], depth: number): void {
    // These properties might contain schema objects with references
    const schemaProperties = [
      'not', 'then', 'else', 'if', 'patternProperties', 
      'propertyNames', 'contains', 'unevaluatedProperties'
    ];
    
    for (const prop of schemaProperties) {
      if (resolved[prop] && typeof resolved[prop] === 'object') {
        resolved[prop] = this.resolveReferences(
          resolved[prop],
          [...context, prop],
          depth + 1
        );
      }
    }
  }
  
  /**
   * Resolve a specific reference
   */
  private resolveRef(ref: string, context: string[], depth: number): any {
    // Generate a cache key to uniquely identify this reference in this context
    const cacheKey = `${ref}:${context.join('/')}`;
    
    // Check cache first to handle circular references
    if (this.resolvedRefs.has(cacheKey)) {
      return this.resolvedRefs.get(cacheKey);
    }
    
    // Create a temporary object for circular reference detection
    const tempObject = { 
      type: "object", 
      description: `Resolving reference: ${ref}`,
      isTemporary: true
    };
    this.resolvedRefs.set(cacheKey, tempObject);
    
    try {
      // Handle local references
      if (ref.startsWith('#/')) {
        const path = ref.replace('#/', '').split('/');
        let target = this.swagger;
        
        // Navigate to the reference target
        for (const segment of path) {
          const decodedSegment = decodeURIComponent(segment);
          if (!target[decodedSegment]) {
            logger.warn(`Invalid reference: ${ref} at context: ${context.join('/')}`);
            return { type: 'object', description: `Invalid reference: ${ref}` };
          }
          target = target[decodedSegment];
        }
        
        // Recursively resolve any nested references
        const resolved = this.resolveReferences(target, context, depth + 1);
        
        // Add original reference metadata
        if (typeof resolved === 'object' && resolved !== null) {
          resolved._originalRef = ref;
        }
        
        // Update the cache with the fully resolved object
        this.resolvedRefs.set(cacheKey, resolved);
        return resolved;
      }
      
      // Handle external references (not implemented)
      logger.warn(`External reference not implemented: ${ref}`);
      const externalRef = { 
        type: 'object', 
        description: `External reference: ${ref} (not resolved)`,
        _originalRef: ref
      };
      this.resolvedRefs.set(cacheKey, externalRef);
      return externalRef;
    } catch (error) {
      // In case of an error, return a special object
      logger.error(`Error resolving reference ${ref}: ${error}`);
      const errorObject = { 
        type: 'object', 
        description: `Error resolving reference ${ref}: ${error}`,
        _originalRef: ref
      };
      this.resolvedRefs.set(cacheKey, errorObject);
      return errorObject;
    }
  }
  
  /**
   * Clear the reference cache
   */
  clearCache(): void {
    this.resolvedRefs.clear();
  }
}