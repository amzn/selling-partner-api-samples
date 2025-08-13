// src/catalog/swagger/swagger-loader.ts

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { SwaggerDocument, ProcessedSwaggerDocument } from '../../types/swagger-types.js';

export class SwaggerLoader {
  /**
   * Load all Swagger/OpenAPI files from a directory recursively
   */
  async loadSwaggerFiles(directoryPath: string): Promise<Map<string, SwaggerDocument>> {
    logger.info(`Loading Swagger files recursively from: ${directoryPath}`);
    
    try {
      // Check if directory exists
      await fs.access(directoryPath);
      
      // Get all Swagger files recursively
      const swaggerFiles = await this.findSwaggerFilesRecursively(directoryPath);
      
      logger.info(`Found ${swaggerFiles.length} potential Swagger/OpenAPI files`);
      
      // Load each file
      const swaggerMap = new Map<string, SwaggerDocument>();
      
      for (const filePath of swaggerFiles) {
        try {
          // Read file content
          const content = await fs.readFile(filePath, 'utf-8');
          
          // Parse JSON (assume all files are JSON for now - could add YAML support later)
          const swagger = JSON.parse(content) as SwaggerDocument;
          
          // Validate if it's actually a Swagger/OpenAPI document
          if (this.isValidSwaggerDocument(swagger)) {
            swaggerMap.set(filePath, swagger);
            logger.debug(`Loaded Swagger file: ${filePath}`);
          } else {
            logger.warn(`File does not appear to be a valid Swagger/OpenAPI document: ${filePath}`);
          }
        } catch (error) {
          logger.error(`Error loading Swagger file ${filePath}:`, error);
        }
      }
      
      logger.info(`Successfully loaded ${swaggerMap.size} Swagger/OpenAPI documents`);
      return swaggerMap;
      
    } catch (error) {
      logger.error(`Error loading Swagger files from ${directoryPath}:`, error);
      throw new Error(`Failed to load Swagger files: ${error}`);
    }
  }

  /**
   * Recursively find all Swagger/OpenAPI files in a directory
   */
  private async findSwaggerFilesRecursively(directoryPath: string): Promise<string[]> {
    const swaggerFiles: string[] = [];
    
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findSwaggerFilesRecursively(fullPath);
          swaggerFiles.push(...subFiles);
        } else if (entry.isFile()) {
          // Check if file has Swagger/OpenAPI extension
          if (entry.name.endsWith('.json') || 
              entry.name.endsWith('.yaml') || 
              entry.name.endsWith('.yml')) {
            swaggerFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.warn(`Error reading directory ${directoryPath}:`, error);
    }
    
    return swaggerFiles;
  }
  
  /**
   * Process a Swagger document by resolving references and enriching data
   */
  processSwagger(swagger: SwaggerDocument): ProcessedSwaggerDocument {
    logger.debug(`Processing Swagger document: ${swagger.info?.title || 'Unnamed API'}`);
    
    try {
      // Create a deep copy to avoid modifying the original
      let processed = JSON.parse(JSON.stringify(swagger)) as ProcessedSwaggerDocument;
      
      // Resolve references with circular detection
      processed = this.processReferencesWithCircularDetection(processed, processed, new Set(), []);
      
      // Enrich operations with additional metadata
      this.enrichOperations(processed);
      
      // Mark as processed
      processed._processed = true;
      
      return processed;
    } catch (error) {
      logger.error(`Error processing Swagger document:`, error);
      throw new Error(`Failed to process Swagger document: ${error}`);
    }
  }
  
  /**
   * Check if an object is a valid Swagger/OpenAPI document
   */
  private isValidSwaggerDocument(obj: any): boolean {
    // Must have info object with title and version
    if (!obj.info || !obj.info.title || !obj.info.version) {
      return false;
    }
    
    // Must have paths object
    if (!obj.paths || typeof obj.paths !== 'object') {
      return false;
    }
    
    // Check for Swagger version or OpenAPI version
    if (!obj.swagger && !obj.openapi) {
      return false;
    }
    
    return true;
  }
  

  /**
   * Process references with proper circular reference detection
   */
  private processReferencesWithCircularDetection(
    swagger: ProcessedSwaggerDocument,
    current: any,
    visited: Set<string>,
    path: string[]
  ): any {
    if (!current || typeof current !== 'object') {
      return current;
    }

    // Handle arrays
    if (Array.isArray(current)) {
      return current.map((item, index) => 
        this.processReferencesWithCircularDetection(swagger, item, visited, [...path, `[${index}]`])
      );
    }

    // Handle $ref
    if (current.$ref && typeof current.$ref === 'string') {
      const ref = current.$ref;
      const currentPath = path.join(' -> ');

      // Check if we've already visited this reference in this path
      if (visited.has(ref)) {
        logger.warn(`Circular reference detected: ${ref} in path ${currentPath}`);
        return {
          type: 'object',
          description: `Circular reference to ${ref}`,
          _circularRef: true,
          _originalRef: ref
        };
      }

      // Resolve the reference
      const resolved = this.resolveReference(swagger, ref);
      if (!resolved) {
        return {
          type: 'object',
          description: `Unresolved reference: ${ref}`,
          _originalRef: ref
        };
      }

      // Add to visited set before processing nested references
      const newVisited = new Set(visited);
      newVisited.add(ref);

      // Process the resolved object recursively
      const processedResolved = this.processReferencesWithCircularDetection(
        swagger,
        resolved,
        newVisited,
        [...path, ref]
      );

      // Add metadata
      if (processedResolved && typeof processedResolved === 'object') {
        processedResolved._originalRef = ref;
      }

      return processedResolved;
    }

    // Process object properties
    const result: any = Array.isArray(current) ? [] : {};
    
    for (const [key, value] of Object.entries(current)) {
      // Skip certain metadata properties to avoid infinite processing
      if (key.startsWith('_') && (key === '_originalRef' || key === '_circularRef' || key === '_processed')) {
        result[key] = value;
        continue;
      }

      result[key] = this.processReferencesWithCircularDetection(
        swagger,
        value,
        visited,
        [...path, key]
      );
    }

    return result;
  }
  
  /**
   * Resolve a single reference
   */
  private resolveReference(swagger: SwaggerDocument, ref: string): any {
    // Handle only internal references for now (#/...)
    if (!ref.startsWith('#/')) {
      logger.warn(`External references not supported yet: ${ref}`);
      return null;
    }
    
    // Parse reference path
    const path = ref.substring(2).split('/');
    
    // Navigate to the referenced object
    let current: any = swagger;
    for (const segment of path) {
      if (current[segment] === undefined) {
        logger.warn(`Reference not found: ${ref}`);
        return null;
      }
      current = current[segment];
    }
    
    // Deep clone to avoid modifying the original
    return JSON.parse(JSON.stringify(current));
  }
  
  /**
   * Enrich operations with additional metadata
   */
  private enrichOperations(swagger: ProcessedSwaggerDocument): void {
    // Process each path
    for (const [path, pathItem] of Object.entries(swagger.paths || {})) {
      // Process each operation (get, post, etc.)
      for (const method of ['get', 'post', 'put', 'delete', 'options', 'head', 'patch']) {
        const operation = pathItem[method as keyof typeof pathItem];
        if (operation) {
          // Add path to operation for reference
          (operation as any)._path = path;
          
          // Add method to operation for reference
          (operation as any)._method = method.toUpperCase();
          
          // Enrich parameters with additional information
          this.enrichParameters(operation);
        }
      }
    }
  }
  
  /**
   * Enrich parameters with additional information
   */
  private enrichParameters(operation: any): void {
    if (!operation.parameters) return;
    
    for (const parameter of operation.parameters) {
      // Add human-readable type description
      if (parameter.type) {
        parameter._typeDescription = this.getTypeDescription(parameter);
      } else if (parameter.schema?.type) {
        parameter._typeDescription = this.getTypeDescription(parameter.schema);
      }
    }
  }
  
  /**
   * Get a human-readable type description
   */
  private getTypeDescription(param: any): string {
    let typeDesc = param.type || 'any';
    
    // Add format if available
    if (param.format) {
      typeDesc += ` (${param.format})`;
    }
    
    // Handle arrays
    if (typeDesc === 'array' && param.items) {
      const itemType = param.items.type || 'any';
      typeDesc = `array of ${itemType}`;
    }
    
    // Add enum values if available
    if (param.enum && Array.isArray(param.enum)) {
      typeDesc += ` - one of [${param.enum.join(', ')}]`;
    }
    
    return typeDesc;
  }
  
}