// src/catalog/swagger/schema-processor.ts

import { logger } from '../../utils/logger.js';

/**
 * Processes and optimizes JSON Schema objects for better presentation
 */
export class SchemaProcessor {
  /**
   * Simplify a complex schema for better documentation
   */
  simplifySchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;
    
    // Make a copy to avoid modifying the original
    const simplified = { ...schema };
    
    // Remove verbose or internal properties
    this.removeVerboseProperties(simplified);
    
    // Generate example values
    if (!simplified.example && !simplified.examples) {
      simplified.example = this.generateExample(simplified);
    }
    
    // Create a human-readable type description
    simplified._typeDescription = this.createTypeDescription(simplified);
    
    // Process properties for object schemas
    if (simplified.properties && typeof simplified.properties === 'object') {
      simplified.properties = this.simplifyProperties(simplified.properties);
    }
    
    return simplified;
  }
  
  /**
   * Remove verbose or internal properties
   */
  private removeVerboseProperties(schema: any): void {
    // Properties to remove for cleaner presentation
    const propsToRemove = [
      '$schema', 'id', '$id', 'discriminator', 'externalDocs',
      'xml', 'deprecated', 'nullable', 'readOnly', 'writeOnly'
    ];
    
    for (const prop of propsToRemove) {
      if (prop in schema) {
        delete schema[prop];
      }
    }
  }
  
  /**
   * Simplify properties of an object schema
   */
  private simplifyProperties(properties: Record<string, any>): Record<string, any> {
    const simplified: Record<string, any> = {};
    
    for (const [name, propSchema] of Object.entries(properties)) {
      simplified[name] = this.simplifySchema(propSchema);
    }
    
    return simplified;
  }
  
  /**
   * Create a human-readable type description
   */
  private createTypeDescription(schema: any): string {
    if (!schema) return 'unknown';
    
    // Handle references 
    if (schema._originalRef) {
      const refName = schema._originalRef.split('/').pop();
      return refName || 'object';
    }
    
    // Handle basic types
    if (schema.type) {
      if (schema.type === 'array' && schema.items) {
        const itemType = schema.items.type || 
                      (schema.items._originalRef ? schema.items._originalRef.split('/').pop() : 'object');
        return `array of ${itemType}`;
      }
      
      if (schema.type === 'object' && schema.properties) {
        const propCount = Object.keys(schema.properties).length;
        return `object with ${propCount} properties`;
      }
      
      return schema.type;
    }
    
    // Handle schema combiners
    if (schema.allOf) return 'combined schema (allOf)';
    if (schema.anyOf) return 'one of several schemas (anyOf)';
    if (schema.oneOf) return 'exactly one schema (oneOf)';
    
    return 'object';
  }
  
  /**
   * Generate a simple example based on schema
   */
  private generateExample(schema: any): any {
    if (!schema) return null;
    
    try {
      // Handle references by using the reference name
      if (schema._originalRef) {
        const refName = schema._originalRef.split('/').pop();
        return `<${refName}>`;
      }
      
      // Handle different types
      if (schema.type === 'string') {
        if (schema.enum && schema.enum.length > 0) return schema.enum[0];
        if (schema.format === 'date-time') return '2025-01-01T12:00:00Z';
        if (schema.format === 'date') return '2025-01-01';
        if (schema.format === 'email') return 'example@example.com';
        if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
        return 'string value';
      }
      
      if (schema.type === 'number' || schema.type === 'integer') {
        if (schema.enum && schema.enum.length > 0) return schema.enum[0];
        return 123;
      }
      
      if (schema.type === 'boolean') return true;
      
      if (schema.type === 'array') {
        if (!schema.items) return [];
        const itemExample = this.generateExample(schema.items);
        return [itemExample];
      }
      
      if (schema.type === 'object' || !schema.type) {
        if (!schema.properties) return {};
        
        const example: Record<string, any> = {};
        const requiredProps = schema.required || [];
        
        // Only include required properties to keep examples small
        for (const prop of requiredProps) {
          if (schema.properties[prop]) {
            example[prop] = this.generateExample(schema.properties[prop]);
          }
        }
        
        // If no required properties, include up to 3 properties
        if (Object.keys(example).length === 0) {
          const propKeys = Object.keys(schema.properties).slice(0, 3);
          for (const prop of propKeys) {
            example[prop] = this.generateExample(schema.properties[prop]);
          }
        }
        
        return example;
      }
      
      return null;
    } catch (error) {
      logger.warn(`Error generating example: ${error}`);
      return null;
    }
  }
}