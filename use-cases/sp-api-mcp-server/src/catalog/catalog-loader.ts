// src/catalog/catalog-loader.ts

import { ApiCatalog } from '../types/api-catalog.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { SwaggerLoader } from './swagger/swagger-loader.js';
import { CatalogMapper } from './swagger/catalog-mapper.js';
import path from 'path';

/**
 * Loads and processes API catalog from Swagger/OpenAPI definitions
 */
export class CatalogLoader {
  private swaggerLoader: SwaggerLoader;
  private catalogMapper: CatalogMapper;
  private catalog: ApiCatalog | null = null;

  constructor() {
    this.swaggerLoader = new SwaggerLoader();
    this.catalogMapper = new CatalogMapper();
  }

  /**
   * Loads API catalog from Swagger/OpenAPI files
   */
  async loadCatalog(): Promise<ApiCatalog> {
    // Return cached catalog if available
    if (this.catalog) {
      return this.catalog;
    }

    logger.info('Loading API catalog...');
    
    try {
      // Step 1: Load Swagger files
      const catalogPath = path.resolve(process.cwd(), config.catalogPath);
      logger.info(`Loading Swagger files from: ${catalogPath}`);
      const swaggerMap = await this.swaggerLoader.loadSwaggerFiles(catalogPath);
      
      // Step 2: Process each Swagger with reference resolution
      const processedSwaggerMap = new Map<string, any>();
      for (const [filePath, swagger] of swaggerMap.entries()) {
        logger.debug(`Processing Swagger file: ${filePath}`);
        const processedSwagger = this.swaggerLoader.processSwagger(swagger);
        processedSwaggerMap.set(filePath, processedSwagger);
      }
      
      // Step 3: Map processed Swagger to API catalog
      this.catalog = this.catalogMapper.mapSwaggerToCatalog(processedSwaggerMap);
      
      logger.info(`API catalog loaded successfully: ${this.catalog.categories.length} categories with ${this.getTotalEndpoints(this.catalog)} total endpoints`);
      return this.catalog;
    } catch (error) {
      logger.error('Failed to load API catalog:', error);
      throw new Error('Failed to load API catalog');
    }
  }

  /**
   * Count total endpoints in catalog for reporting
   */
  private getTotalEndpoints(catalog: ApiCatalog): number {
    let count = 0;
    for (const category of catalog.categories) {
      count += category.endpoints.length;
      
      if (category.subcategories) {
        for (const subcategory of category.subcategories) {
          count += subcategory.endpoints.length;
        }
      }
    }
    return count;
  }

  /**
   * Refresh the catalog by clearing cache and reloading
   */
  async refreshCatalog(): Promise<ApiCatalog> {
    logger.info('Refreshing API catalog...');
    this.catalog = null;
    return await this.loadCatalog();
  }

  /**
   * Get a specific category by name
   */
  getCategoryByName(name: string): ApiCatalog['categories'][0] | undefined {
    if (!this.catalog) {
      throw new Error('Catalog not loaded');
    }
    
    return this.catalog.categories.find(c => 
      c.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get a specific endpoint by ID
   */
  getEndpointById(id: string): { endpoint: any; category: string } | undefined {
    if (!this.catalog) {
      throw new Error('Catalog not loaded');
    }
    
    for (const category of this.catalog.categories) {
      const endpoint = category.endpoints.find(e => e.id === id);
      if (endpoint) {
        return { endpoint, category: category.name };
      }
      
      if (category.subcategories) {
        for (const subcategory of category.subcategories) {
          const endpoint = subcategory.endpoints.find(e => e.id === id);
          if (endpoint) {
            return { endpoint, category: `${category.name} > ${subcategory.name}` };
          }
        }
      }
    }
    
    return undefined;
  }
}