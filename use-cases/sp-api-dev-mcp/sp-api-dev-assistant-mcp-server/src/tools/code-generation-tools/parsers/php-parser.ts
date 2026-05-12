import { BaseParser, BasicUsage } from "./base-parser.js";
import { Category, Operation, Model, Parameter } from "../models/index.js";
import { FileSystemUtils } from "../../../utils/file-system.js";
import {
  ErrorHandlingUtils,
  ErrorCode,
} from "../../../utils/error-handling.js";

/**
 * PHP language parser for Amazon Selling Partner API SDK
 * Parses PHP SDK files to extract categories, operations, models, and usage information
 */
export class PHPParser extends BaseParser {
  constructor(repositoryPath: string) {
    super(repositoryPath, "php");
  }

  /**
   * Parse SDK categories from PHP API files
   * Traverses the PHP SDK API directory and extracts category information
   */
  async parseCategories(): Promise<Category[]> {
    try {
      const apiPath = this.getLanguagePath("sdk/lib/Api");

      if (!(await this.directoryExists(apiPath))) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.FILE_NOT_FOUND,
          `PHP API directory not found: ${apiPath}`,
          {
            apiPath,
            language: this.language,
          },
        );
      }

      const categories: Category[] = [];
      const files = await this.findFiles(apiPath, /\.php$/);

      for (const filePath of files) {
        try {
          const content = await this.readTextFile(filePath);

          // Check if file contains class definition and comment block
          if (!content.includes("*/") || !content.includes("class ")) {
            continue;
          }

          // Extract class name
          let className = "";
          const lines = content.split("\n");
          for (const line of lines) {
            if (line.startsWith("class ")) {
              className = line.split("class ")[1];
              break;
            }
          }

          if (!className) {
            continue;
          }

          // Extract namespace
          const namespaceMatch = content.match(/namespace\s+([^;]+);/);
          if (!namespaceMatch) {
            continue;
          }
          const packageName = namespaceMatch[1];

          // Extract description from comment block (third /** block)
          const commentBlocks = content.split("/**");
          let description = "No description available";
          if (commentBlocks.length > 2) {
            description = this.extractBetweenDelimiters(
              commentBlocks[2],
              "",
              "*/",
            );
          }

          // Extract category from path
          const relativePath = FileSystemUtils.getRelativePath(
            apiPath,
            filePath,
          );
          const category = FileSystemUtils.getDirname(relativePath);

          // Build paths
          const modelsPath = filePath
            .replace("/Api/", "/Model/")
            .replace(`/${FileSystemUtils.getBasename(filePath)}`, "");
          const importPath = `use ${packageName}\\${className};`;

          const categoryObj: Category = {
            name: `${category}.${className}`,
            description: description || "No description available",
            operationsPath: filePath,
            modelsPath,
            importPath,
          };

          categories.push(categoryObj);
        } catch (error) {
          // Log error but continue processing other files
          this.logError(`Failed to process category file: ${filePath}`, error);
          continue;
        }
      }

      return categories;
    } catch (error) {
      throw this.createParsingError(
        "parse categories",
        "PHP API directory",
        error as Error,
      );
    }
  }

  /**
   * Parse operations from a specific PHP API file
   * Extracts method definitions, parameters, and documentation
   */
  async parseOperations(filePath: string): Promise<Operation[]> {
    try {
      if (!(await this.fileExists(filePath))) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.FILE_NOT_FOUND,
          `Operations file not found: ${filePath}`,
          {
            filePath,
            language: this.language,
          },
        );
      }

      const content = await this.readTextFile(filePath);
      const operations: Operation[] = [];

      // Extract class name (match actual PHP class declaration, not comments)
      const classMatch = content.match(/^class\s+(\w+)/m);
      const className = classMatch ? classMatch[1] : "";

      // Split by ' /**' to find PHPDoc comments
      const phpdocSections = content.split(" /**");

      for (let i = 1; i < phpdocSections.length; i++) {
        try {
          const section = phpdocSections[i];

          if (!section.includes("*/")) {
            continue;
          }

          const operation = await this.parsePHPOperation(section, className);
          if (operation) {
            operations.push(operation);
          }
        } catch (error) {
          this.logError(`Failed to parse operation in section ${i}`, error);
          continue;
        }
      }

      return operations;
    } catch (error) {
      return this.handleParsingError("parse operations", filePath, error, []);
    }
  }

  /**
   * Parse models from a PHP models directory
   * Handles openAPITypes, attribute maps, and enum detection
   */
  async parseModels(directoryPath: string): Promise<Model[]> {
    try {
      if (!(await this.directoryExists(directoryPath))) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.FILE_NOT_FOUND,
          `Models directory not found: ${directoryPath}`,
          {
            directoryPath,
            language: this.language,
          },
        );
      }

      const models: Model[] = [];
      const files = await this.findFiles(directoryPath, /\.php$/);

      for (const filePath of files) {
        try {
          const content = await this.readTextFile(filePath);

          const model = await this.parsePHPModel(content);
          if (model) {
            models.push(model);
          }
        } catch (error) {
          this.logError(`Failed to process model file: ${filePath}`, error);
          continue;
        }
      }

      return models;
    } catch (error) {
      return this.handleParsingError("parse models", directoryPath, error, []);
    }
  }

  /**
   * Parse basic usage information for PHP SDK
   * Extracts authentication and configuration files
   */
  async parseBasicUsage(): Promise<BasicUsage> {
    try {
      const authPath = this.getLanguagePath("sdk/src/authandauth");

      if (!(await this.directoryExists(authPath))) {
        return {};
      }

      const usage: BasicUsage = {};
      const files = await this.findFiles(authPath, /\.php$/);

      for (const filePath of files) {
        try {
          const fileName = FileSystemUtils.getBasename(filePath, ".php");
          const content = await this.readTextFile(filePath);
          usage[fileName] = content;
        } catch (error) {
          this.logWarning(`Failed to read usage file: ${filePath}`, { error });
          continue;
        }
      }

      const readme = this.getLanguagePath("README.md");
      if (await this.fileExists(readme)) {
        try {
          usage.readme = await this.readTextFile(readme);
        } catch (error) {
          this.logWarning("Failed to read README.md");
          usage.readme = "Failed to read README.md";
        }
      } else {
        usage.readme = "Failed to read README.md";
      }

      return usage;
    } catch (error) {
      throw this.createParsingError(
        "parse basic usage",
        "PHP SDK directory",
        error as Error,
      );
    }
  }

  /**
   * Parse a single PHP operation from PHPDoc and method definition
   */
  private async parsePHPOperation(
    section: string,
    className: string,
  ): Promise<Operation | null> {
    try {
      if (!section.includes("*/")) {
        return null;
      }

      // Split into PHPDoc and method parts
      const parts = section.split("*/");
      if (parts.length < 2) {
        return null;
      }

      const phpdoc = parts[0];
      const methodPart = parts[1];

      // Extract method name
      const methodMatch = methodPart.match(/(\w+)\s*\(/);
      if (!methodMatch) {
        return null;
      }
      const methodName = methodMatch[1];

      // Parse PHPDoc
      let description = "No description available";
      let returnedModel = "";
      const parameters: Parameter[] = [];

      const phpdocLines = phpdoc.split("\n");

      // Extract description (first few lines before @param or @return)
      const descriptionLines: string[] = [];
      for (const line of phpdocLines) {
        const trimmed = line.trim().replace(/^\*\s*/, "");
        if (trimmed.startsWith("@")) {
          break;
        }
        if (trimmed) {
          descriptionLines.push(trimmed);
        }
      }
      if (descriptionLines.length > 0) {
        description = descriptionLines.slice(0, 3).join("\n");
      }

      // Parse @param and @return tags
      for (let index = 0; index < phpdocLines.length; index++) {
        const line = phpdocLines[index];
        const trimmed = line.trim().replace(/^\*\s*/, "");

        if (trimmed.startsWith("@return")) {
          const returnPart = trimmed.split("@return")[1];
          if (returnPart) {
            returnedModel = returnPart.trim();
          }
        } else if (trimmed.startsWith("@param")) {
          try {
            const paramPart = trimmed.split("@param ")[1];
            if (!paramPart) continue;

            const spaceIndex = paramPart.indexOf(" ");
            if (spaceIndex === -1) continue;

            const paramType = paramPart.substring(0, spaceIndex);
            const afterType = paramPart.substring(spaceIndex + 1);

            const nextSpaceIndex = afterType.indexOf(" ");
            if (nextSpaceIndex === -1) continue;

            const paramName = afterType.substring(0, nextSpaceIndex);
            let paramDesc = afterType.substring(nextSpaceIndex + 1);

            // Include next line if it exists and doesn't start with @
            if (index + 1 < phpdocLines.length) {
              const nextLine = phpdocLines[index + 1]
                .trim()
                .replace(/^\*\s*/, "")
                .replace(/\t/g, "")
                .replace(/\n/g, "");
              if (nextLine && !nextLine.startsWith("@")) {
                paramDesc += " " + nextLine;
              }
            }

            const parameter: Parameter = {
              name: paramName,
              description: paramDesc,
              type: paramType,
              required: trimmed.includes("required"),
            };

            parameters.push(parameter);
          } catch (error) {
            this.logWarning(`Failed to parse parameter from line: ${trimmed}`, {
              error,
            });
            continue;
          }
        }
      }

      // Look up rate limit from YAML map
      const rateLimit = await this.lookupRateLimit(className, methodName);

      const operation: Operation = {
        name: methodName,
        description,
        callMethod: methodName,
        returnedModel: returnedModel || "Unknown",
        rateLimit,
        ...(parameters.length > 0 ? { inputParameters: parameters } : {}),
      };

      return operation;
    } catch (error) {
      this.logError(`Failed to parse PHP operation`, error);
      return null;
    }
  }

  /**
   * Parse a single PHP model from class definition
   */
  private async parsePHPModel(content: string): Promise<Model | null> {
    try {
      const lines = content.split("\n");
      let name = "";
      let swaggerType: Record<string, string> = {};
      let attributeMap: Record<string, string> = {};
      let isEnum = false;
      let enumValues: string[] = [];

      // Extract class name
      const classMatch = content.match(/\nclass\s+(\w+)\s+/);
      if (classMatch) {
        name = classMatch[1];
      }

      if (!name) {
        return null;
      }

      // Check if it's an enum
      if (content.includes("enum.")) {
        isEnum = true;

        // Parse enum values from public const declarations
        for (const line of lines) {
          if (line.includes("public const ")) {
            const constMatch = line.match(/public const\s+(\w+)\s*=/);
            if (constMatch) {
              enumValues.push(constMatch[1]);
            }
          }
        }
        enumValues.sort();
      } else {
        // Parse openAPITypes
        if (content.includes("openAPITypes")) {
          const typesMatch = content.match(/openAPITypes[^[]*\[([^\]]+)\]/);
          if (typesMatch) {
            const typesContent = typesMatch[1];
            const typeEntries = typesContent.split(",");

            for (const entry of typeEntries) {
              const entryMatch = entry.match(/'([^']+)'\s*=>\s*'([^']+)'/);
              if (entryMatch) {
                swaggerType[entryMatch[1]] = entryMatch[2];
              }
            }
          }
        }

        // Parse $attributeMap
        if (content.includes("$attributeMap")) {
          const mapMatch = content.match(/\$attributeMap[^[]*\[([^\]]+)\]/);
          if (mapMatch) {
            const mapContent = mapMatch[1];
            const mapEntries = mapContent.split(", ");

            for (const entry of mapEntries) {
              const entryMatch = entry.match(/'([^']+)'\s*=>\s*'([^']+)'/);
              if (entryMatch) {
                attributeMap[entryMatch[1]] = entryMatch[2];
              }
            }
          }
        } else {
          // Parse public const declarations for swagger types
          for (const line of lines) {
            if (line.includes("public const ")) {
              const constMatch = line.match(
                /public const\s+(\w+)\s*=\s*'([^']+)'/,
              );
              if (constMatch) {
                swaggerType[constMatch[1]] = constMatch[2];
              }
            }
          }
        }
      }

      const model: Model = {
        name,
        swaggerType,
        attributeMap,
        isEnum,
        ...(isEnum && enumValues.length > 0 ? { enumValues } : {}),
      };

      return model;
    } catch (error) {
      this.logError("Failed to parse PHP model", error);
      return null;
    }
  }
}
