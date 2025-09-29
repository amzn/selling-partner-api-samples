// src/catalog/cache/catalog-cache.ts

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { ApiCatalog } from '../../types/api-catalog.js';

/**
 * Cache for processed API catalogs to improve loading performance
 */
export class CatalogCache {
  private cacheDir: string;
  private cacheTTL: number; // Time-to-live in milliseconds
  
  constructor(cacheDir: string = './.cache', cacheTTL: number = 24 * 60 * 60 * 1000) {
    this.cacheDir = cacheDir;
    this.cacheTTL = cacheTTL;
  }
  
  /**
   * Initialize the cache directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      logger.debug(`Catalog cache initialized at ${this.cacheDir}`);
    } catch (error) {
      logger.warn(`Failed to initialize catalog cache directory: ${error}`);
      // Continue without caching if we can't create the directory
    }
  }
  
  /**
   * Get a cached catalog if available and not expired
   */
  async getCachedCatalog(
    swaggerPaths: string[], 
    swaggerMtimes: Record<string, number>
  ): Promise<ApiCatalog | null> {
    try {
      const cacheKey = this.generateCacheKey(swaggerPaths, swaggerMtimes);
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      // Check if cache file exists
      try {
        const stats = await fs.stat(cacheFile);
        
        // Check if cache is expired
        const now = Date.now();
        if (now - stats.mtimeMs > this.cacheTTL) {
          logger.debug('Catalog cache expired');
          return null;
        }
        
        // Read and parse cache file
        const cacheData = await fs.readFile(cacheFile, 'utf-8');
        const catalog = JSON.parse(cacheData) as ApiCatalog;
        
        logger.info('Using cached catalog');
        return catalog;
      } catch (error) {
        // Cache file doesn't exist or can't be read
        return null;
      }
    } catch (error) {
      logger.warn(`Error reading catalog cache: ${error}`);
      return null;
    }
  }
  
  /**
   * Save a catalog to the cache
   */
  async saveCatalog(
    catalog: ApiCatalog, 
    swaggerPaths: string[], 
    swaggerMtimes: Record<string, number>
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(swaggerPaths, swaggerMtimes);
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      // Serialize catalog to JSON
      const cacheData = JSON.stringify(catalog, null, 2);
      
      // Write to cache file
      await fs.writeFile(cacheFile, cacheData, 'utf-8');
      logger.info(`Catalog saved to cache at ${cacheFile}`);
    } catch (error) {
      logger.warn(`Failed to save catalog to cache: ${error}`);
      // Continue without caching if write fails
    }
  }
  
  /**
   * Clear all cached catalogs
   */
  async clearCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
      
      logger.info('Catalog cache cleared');
    } catch (error) {
      logger.warn(`Failed to clear catalog cache: ${error}`);
    }
  }
  
  /**
   * Generate a cache key based on swagger files and their modification times
   */
  private generateCacheKey(
    swaggerPaths: string[], 
    swaggerMtimes: Record<string, number>
  ): string {
    // Sort paths for consistent key generation
    const sortedPaths = [...swaggerPaths].sort();
    
    // Create a string with filenames and mtimes
    const keyParts = sortedPaths.map(filePath => {
      const fileName = path.basename(filePath);
      const mtime = swaggerMtimes[filePath] || 0;
      return `${fileName}-${mtime}`;
    });
    
    // Join parts and create a hash
    const keyString = keyParts.join('|');
    return this.hashString(keyString);
  }
  
  /**
   * Simple string hashing function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Convert to positive hex string
    return (hash >>> 0).toString(16);
  }
  
  /**
   * Check if a swagger file has been modified since it was cached
   */
  async checkForUpdates(
    swaggerPaths: string[]
  ): Promise<{ modified: boolean; mtimes: Record<string, number> }> {
    const mtimes: Record<string, number> = {};
    let modified = false;
    
    // Get the most recent cache file
    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      if (cacheFiles.length === 0) {
        // No cache files, so consider everything modified
        modified = true;
      } else {
        // Get stats for all cache files
        const cacheStats = await Promise.all(
          cacheFiles.map(async file => ({
            file,
            stats: await fs.stat(path.join(this.cacheDir, file))
          }))
        );
        
        // Find most recent cache file by mtime
        const mostRecentCache = cacheStats.reduce((prev, current) => {
          return (prev.stats.mtimeMs > current.stats.mtimeMs) ? prev : current;
        });
        
        // Check modification times of swagger files
        for (const swaggerPath of swaggerPaths) {
          try {
            const stats = await fs.stat(swaggerPath);
            mtimes[swaggerPath] = stats.mtimeMs;
            
            // If any swagger file is newer than the cache, consider modified
            if (stats.mtimeMs > mostRecentCache.stats.mtimeMs) {
              modified = true;
            }
          } catch (error) {
            logger.warn(`Cannot stat swagger file ${swaggerPath}: ${error}`);
            modified = true; // Consider modified if we can't check
          }
        }
      }
    } catch (error) {
      logger.warn(`Error checking for updates: ${error}`);
      modified = true; // Consider modified if error occurs
    }
    
    return { modified, mtimes };
  }
}