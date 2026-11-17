import * as fs from "fs/promises";
import * as path from "path";
import { ErrorHandlingUtils } from "./error-handling.js";

/**
 * File system utilities for safe file operations with error handling
 */
export class FileSystemUtils {
  /**
   * Safely read a file with error handling
   * @param filePath - Path to the file to read
   * @returns Promise resolving to file contents as string
   * @throws ServiceError for file system errors
   */
  static async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch (error) {
      throw ErrorHandlingUtils.createFileSystemError(
        "read",
        filePath,
        error as Error,
      );
    }
  }

  /**
   * Safely check if a file exists
   * @param filePath - Path to check
   * @returns Promise resolving to true if file exists, false otherwise
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Safely check if a directory exists
   * @param dirPath - Path to check
   * @returns Promise resolving to true if directory exists, false otherwise
   */
  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Safely read directory contents
   * @param dirPath - Path to the directory to read
   * @returns Promise resolving to array of file/directory names
   * @throws ServiceError for file system errors
   */
  static async readDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch (error) {
      throw ErrorHandlingUtils.createFileSystemError(
        "read directory",
        dirPath,
        error as Error,
      );
    }
  }

  /**
   * Safely get file stats
   * @param filePath - Path to the file
   * @returns Promise resolving to file stats
   * @throws ServiceError for file system errors
   */
  static async getStats(
    filePath: string,
  ): Promise<Awaited<ReturnType<typeof fs.stat>>> {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      throw ErrorHandlingUtils.createFileSystemError(
        "stat",
        filePath,
        error as Error,
      );
    }
  }

  /**
   * Recursively find files matching a pattern
   * @param dirPath - Directory to search in
   * @param pattern - RegExp pattern to match filenames
   * @returns Promise resolving to array of matching file paths
   * @throws ServiceError for file system errors
   */
  static async findFiles(dirPath: string, pattern: RegExp): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await this.readDirectory(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = await this.getStats(fullPath);

        if (stat.isDirectory()) {
          // Recursively search subdirectories
          const subResults = await this.findFiles(fullPath, pattern);
          results.push(...subResults);
        } else if (pattern.test(entry)) {
          results.push(fullPath);
        }
      }

      return results;
    } catch (error) {
      if (ErrorHandlingUtils.isServiceError(error)) {
        throw error;
      }
      throw ErrorHandlingUtils.createFileSystemError(
        "find files",
        dirPath,
        error as Error,
      );
    }
  }

  /**
   * Normalize and resolve a file path
   * @param filePath - Path to normalize
   * @returns Normalized absolute path
   */
  static normalizePath(filePath: string): string {
    return path.resolve(path.normalize(filePath));
  }

  /**
   * Get the relative path from one directory to another
   * @param from - Source directory
   * @param to - Target path
   * @returns Relative path
   */
  static getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Join path segments safely
   * @param segments - Path segments to join
   * @returns Joined path
   */
  static joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  /**
   * Get the directory name of a path
   * @param filePath - File path
   * @returns Directory name
   */
  static getDirname(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * Get the base name of a path
   * @param filePath - File path
   * @param ext - Optional extension to remove
   * @returns Base name
   */
  static getBasename(filePath: string, ext?: string): string {
    return path.basename(filePath, ext);
  }

  /**
   * Get the extension of a file
   * @param filePath - File path
   * @returns File extension including the dot
   */
  static getExtension(filePath: string): string {
    return path.extname(filePath);
  }
}
