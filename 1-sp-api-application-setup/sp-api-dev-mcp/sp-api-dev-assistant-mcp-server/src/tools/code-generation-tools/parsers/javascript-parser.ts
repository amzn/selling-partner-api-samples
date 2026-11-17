import { BaseParser, BasicUsage } from "./base-parser.js";
import { Category, Operation, Model, Parameter } from "../models/index.js";
import { FileSystemUtils } from "../../../utils/file-system.js";
import {
  ErrorHandlingUtils,
  ErrorCode,
} from "../../../utils/error-handling.js";

/**
 * JavaScript language parser for Amazon Selling Partner API SDK
 * Parses JavaScript SDK files to extract categories, operations, models, and usage information
 */
export class JavaScriptParser extends BaseParser {
  constructor(repositoryPath: string) {
    super(repositoryPath, "javascript");
  }

  /**
   * Parse SDK categories from JavaScript API files
   * Traverses the JavaScript SDK API directory and extracts category information
   */
  async parseCategories(): Promise<Category[]> {
    try {
      const apiPath = this.getLanguagePath("sdk/src");
      const indexPath = this.getLanguagePath("sdk/index.js");

      if (!(await this.directoryExists(apiPath))) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.FILE_NOT_FOUND,
          `JavaScript API directory not found: ${apiPath}`,
          { apiPath, language: this.language },
        );
      }

      // Parse exports from index.js to get export mappings
      const exports: Record<string, string> = {};
      if (await this.fileExists(indexPath)) {
        try {
          const indexContent = await this.readTextFile(indexPath);
          const lines = indexContent.split("\n");

          for (const line of lines) {
            if (line.includes("export") && line.includes("as ")) {
              const pathMatch = line.split("/")[line.split("/").length - 2];
              const asMatch = line.split("as ")[1].split(" ")[0];
              if (pathMatch && asMatch) {
                exports[pathMatch] = asMatch;
              }
            }
          }
        } catch (error) {
          this.logWarning("Failed to parse index.js exports", { error });
        }
      }
      const categories: Category[] = [];
      const files = await this.findFiles(apiPath, /\.js$/);

      for (const filePath of files) {
        try {
          // Only process files in 'api' directories
          if (!filePath.includes("/api/")) {
            continue;
          }

          const content = await this.readTextFile(filePath);

          // Check if file contains class definition and comment block
          if (!content.includes("*/") || !content.includes("class ")) {
            continue;
          }

          // Extract class name from @module annotation
          const moduleMatch = content.match(/@module\s+([^\n]+)/);
          if (!moduleMatch) {
            continue;
          }
          const modulePath = moduleMatch[1];
          const className =
            modulePath.split("/")[modulePath.split("/").length - 1] || "";

          // Extract description from JSDoc comment
          const jsdocMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
          let description = "No description available";
          if (jsdocMatch) {
            const jsdocContent = jsdocMatch[1];
            const descLines = jsdocContent
              .split("\n")
              .map((line) => line.replace(/^\s*\*\s?/, "").trim())
              .filter((line) => line && !line.startsWith("@"))
              .slice(0, 3);
            description = descLines.join("\n");
          }

          // Build paths
          const modelsPath = FileSystemUtils.getDirname(filePath).replace(
            "/api",
            "/model",
          );

          // Get import path from exports mapping
          const pathSegments = filePath.split("/");
          const categoryKey = pathSegments[pathSegments.length - 3]; // Get directory name
          const importName = exports[categoryKey] || className;
          const importPath = `import {${importName}} from '@amazon-sp-api-release/amazon-sp-api-sdk-js';`;

          const category: Category = {
            name: `${importName}.${className}`,
            description,
            operationsPath: filePath,
            modelsPath,
            importPath,
          };

          categories.push(category);
        } catch (error) {
          // Log error but continue processing other files
          this.logError(`Failed to process category file: ${filePath}`, error);
          continue;
        }
      }
      this.logWarning(`${exports}`);
      return categories;
    } catch (error) {
      throw this.createParsingError(
        "parse categories",
        "JavaScript API directory",
        error as Error,
      );
    }
  }

  /**
   * Parse operations from a specific JavaScript API file
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

      if (!content.includes("export class ")) {
        return [];
      }

      const operations: Operation[] = [];

      // Extract class name from @module annotation
      const moduleMatch = content.match(/@module\s+([^\n]+)/);
      if (!moduleMatch) {
        return [];
      }
      const modulePath = moduleMatch[1];
      const className = modulePath.split("/").pop() || "";

      // Find the export class section
      const exportClassMatch = content.match(/export class([\s\S]*)/);
      if (!exportClassMatch) {
        return [];
      }
      const classContent = exportClassMatch[1];

      // Split by /** to find JSDoc comments
      const jsdocSections = classContent.split("/**");

      for (let i = 1; i < jsdocSections.length; i++) {
        try {
          const section = jsdocSections[i];

          if (!section.includes("*/")) {
            continue;
          }

          const operation = await this.parseJavaScriptOperation(
            section,
            className,
          );
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
   * Parse models from a JavaScript models directory
   * Handles type definitions and enum detection
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
      const files = await this.findFiles(directoryPath, /\.js$/);

      for (const filePath of files) {
        try {
          const content = await this.readTextFile(filePath);

          const model = await this.parseJavaScriptModel(content);
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
   * Parse basic usage information for JavaScript SDK
   * Extracts example usage from sample application
   */
  async parseBasicUsage(): Promise<BasicUsage> {
    try {
      const examplePath = this.getLanguagePath("sdk/sample-node-app/index.js");

      const usage: BasicUsage = {};

      if (await this.fileExists(examplePath)) {
        try {
          const content = await this.readTextFile(examplePath);
          usage.example = content;
        } catch (error) {
          this.logWarning("Failed to read example file", {
            examplePath,
            error,
          });
          usage.example = "Example file not available";
        }
      } else {
        usage.example = "Example file not found";
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
        "JavaScript SDK directory",
        error as Error,
      );
    }
  }

  /**
   * Parse a single JavaScript operation from JSDoc and method definition
   */
  private async parseJavaScriptOperation(
    section: string,
    className: string,
  ): Promise<Operation | null> {
    try {
      if (!section.includes("*/")) {
        return null;
      }

      // Split into JSDoc and method parts
      const parts = section.split("*/");
      if (parts.length < 2) {
        return null;
      }

      const jsdoc = parts[0];
      const methodPart = parts[1];

      // Extract method name and signature
      const methodMatch = methodPart.match(/(\w+)\s*\([^)]*\)/);
      if (!methodMatch) {
        return null;
      }
      const methodName = methodMatch[1];

      // Parse JSDoc
      let description = "No description available";
      let returnedModel = "";
      const parameters: Parameter[] = [];

      const jsdocLines = jsdoc.split("\n");

      // Extract description (first line that's not empty and not a tag)
      for (const line of jsdocLines) {
        const trimmed = line.trim().replace(/^\*\s*/, "");
        if (trimmed && !trimmed.startsWith("@")) {
          description = trimmed.split(". ")[0];
          break;
        }
      }

      // Parse @param and @return tags
      for (const line of jsdocLines) {
        const trimmed = line.trim().replace(/^\*\s*/, "");

        if (trimmed.startsWith("@return")) {
          const returnPart = trimmed.split("@return")[1];
          if (returnPart) {
            const returnWords = returnPart.trim().split(" ");
            if (returnWords.length > 0) {
              returnedModel = returnWords[0];
            }
          }
        } else if (trimmed.startsWith("@param")) {
          try {
            const paramPart = trimmed.split("@param ")[1];
            if (!paramPart) continue;

            // Parse JSDoc format: @param {type} name description
            // Supports both plain names and bracketed optional names: [opts], [opts.sellerId]
            const typeMatch = paramPart.match(
              /^\{([^}]+)\}\s+(\[?[\w.]+\]?)\s+(.*)/,
            );
            if (typeMatch) {
              const paramType = typeMatch[1];
              let paramName = typeMatch[2];
              const paramDesc = typeMatch[3];

              // Determine if this is an optional parameter (bracketed)
              const isBracketed =
                paramName.startsWith("[") && paramName.endsWith("]");
              if (isBracketed) {
                paramName = paramName.slice(1, -1); // Remove brackets
              }

              // Skip the opts container object itself (e.g., "opts")
              if (paramName === "opts") continue;

              // For opts.* params, extract the property name
              const isOptsProp = paramName.startsWith("opts.");
              if (isOptsProp) {
                paramName = paramName.substring(5); // Remove "opts." prefix
              }

              const isRequired = !isOptsProp && !isBracketed;

              const parameter: Parameter = {
                name: paramName,
                description: paramDesc,
                type: paramType
                  .replace(/\s+/g, "")
                  .replace(/\n/g, "")
                  .replace(/\t/g, ""),
                required: isRequired,
              };

              parameters.push(parameter);
            }
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
        callMethod: `${className}.${methodName}`,
        returnedModel: returnedModel || "Unknown",
        rateLimit,
        ...(parameters.length > 0 ? { inputParameters: parameters } : {}),
      };

      return operation;
    } catch (error) {
      this.logError(`Failed to parse JavaScript operation`, error);
      return null;
    }
  }

  /**
   * Parse a single JavaScript model from class definition
   */
  private async parseJavaScriptModel(content: string): Promise<Model | null> {
    try {
      const lines = content.split("\n");
      let name = "";
      let swaggerType: Record<string, string> = {};
      let attributeMap: Record<string, string> = {};
      let isEnum = false;
      let enumValues: string[] = [];

      // Check if it's an enum
      const isObjectFreezeEnum =
        /export\s+const\s+(\w+)\s*=\s*Object\.freeze\s*\(/.test(content);
      if (content.includes("Enum class") || isObjectFreezeEnum) {
        isEnum = true;

        // Parse enum values
        for (const line of lines) {
          if (line.includes(" = ")) {
            const enumMatch = line.match(/'([^']+)'/);
            if (enumMatch) {
              enumValues.push(enumMatch[1]);
            }
          }
        }

        // Extract name from export class or export const Object.freeze
        const classMatch = content.match(/export class\s+(\w+)\s+/);
        if (classMatch) {
          name = classMatch[1];
        } else {
          const constMatch = content.match(
            /export\s+const\s+(\w+)\s*=\s*Object\.freeze\s*\(/,
          );
          if (constMatch) {
            name = constMatch[1];
          }
        }
      } else {
        // Regular class
        const classMatch = content.match(/\nexport class\s+(\w+)\s+/);
        if (classMatch) {
          name = classMatch[1];
        }

        // Parse @member annotations
        const memberSections = content.split("/**");

        for (const section of memberSections) {
          if (section.includes("@member")) {
            const memberLines = section.split("\n");
            let memberName = null;
            let memberType = null;

            for (let i = 0; i < memberLines.length; i++) {
              const line = memberLines[i];

              if (line.includes("@member")) {
                if (line.includes("{[")) {
                  memberName = line.split("{[")[1].split("]}")[0];
                } else {
                  if (line.includes("{{")) {
                    memberName = line.split("{{")[1].split("}}")[0];
                  } else {
                    memberName = line.split("{")[1].split("}")[0];
                  }
                }
              } else if (line.includes("@type")) {
                //memberType = line.split('{[')[1].split(']}')[0]
                if (line.includes("{[")) {
                  memberType = line.split("{[")[1].split("]}")[0];
                } else {
                  if (line.includes("{{")) {
                    memberType = line.split("{{")[1].split("}}")[0];
                  } else {
                    memberType = line.split("{")[1].split("}")[0];
                  }
                }
              }

              if (memberName && memberType) {
                swaggerType[memberName] = memberType;
                attributeMap[memberName] = memberName;
              }
            }
          }
        }
      }

      if (!name) {
        return null;
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
      this.logError("Failed to parse JavaScript model", error);
      return null;
    }
  }
}
