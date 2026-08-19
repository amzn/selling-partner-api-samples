import { BaseParser, BasicUsage } from "./base-parser.js";
import { Category, Operation, Model, Parameter } from "../models/index.js";
import { FileSystemUtils } from "../../../utils/file-system.js";
import {
  ErrorHandlingUtils,
  ErrorCode,
} from "../../../utils/error-handling.js";

/**
 * Python language parser for Amazon Selling Partner API SDK
 * Parses Python SDK files to extract categories, operations, models, and usage information
 */
export class PythonParser extends BaseParser {
  constructor(repositoryPath: string) {
    super(repositoryPath, "python");
  }

  /**
   * Parse SDK categories from Python API files
   * Traverses the Python SDK API directory and extracts category information
   */
  async parseCategories(): Promise<Category[]> {
    try {
      const apiPath = this.getLanguagePath("sdk/spapi/api");

      if (!(await this.directoryExists(apiPath))) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.FILE_NOT_FOUND,
          `Python API directory not found: ${apiPath}`,
          {
            apiPath,
            language: this.language,
          },
        );
      }

      const categories: Category[] = [];
      const files = await this.findFiles(apiPath, /\.py$/);

      for (const filePath of files) {
        // Skip __init__.py files
        if (filePath.includes("__init__")) {
          continue;
        }

        try {
          const content = await this.readTextFile(filePath);

          // Check if file contains class definition and docstring
          if (!content.includes('"""') || !content.includes("class ")) {
            continue;
          }

          // Extract category name from directory structure
          const relativePath = FileSystemUtils.getRelativePath(
            apiPath,
            filePath,
          );
          const categoryName = relativePath
            .replace(".py", "")
            .replace("/", ".");

          // Extract class name
          const classMatch = content.match(/^class\s+(\w+)\s*\(/m);
          if (!classMatch) {
            continue;
          }
          const className = classMatch[1];

          // Extract description from docstring
          const description = this.extractBetweenDelimiters(
            content,
            '"""',
            '"""',
          );

          // Build paths
          const modelsPath = filePath.replace("/api/", "/models/");
          const importPath = `from spapi.api.${categoryName} import ${className}`;

          const category: Category = {
            name: categoryName,
            description: description || "No description available",
            operationsPath: filePath,
            modelsPath: FileSystemUtils.getDirname(modelsPath),
            importPath,
          };

          categories.push(category);
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
        "Python API directory",
        error as Error,
      );
    }
  }

  /**
   * Parse operations from a specific Python API file
   * Extracts function definitions, parameters, and documentation
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

      if (!content.includes("class ")) {
        return [];
      }

      const operations: Operation[] = [];

      // Extract class name
      const classMatch = content.match(/^class\s+(\w+)\s*\(/m);
      if (!classMatch) {
        return [];
      }
      const className = classMatch[1];

      // Find all method definitions (excluding __init__)
      const methodRegex = /def\s+(\w+)\s*\([^)]*self[^)]*\):/g;
      let methodMatch;

      while ((methodMatch = methodRegex.exec(content)) !== null) {
        const methodName = methodMatch[1];

        // Skip __init__ and other special methods
        if (methodName.startsWith("__")) {
          continue;
        }

        try {
          const operation = await this.parseOperation(
            content,
            methodName,
            className,
          );
          if (operation) {
            operations.push(operation);
          }
        } catch (error) {
          this.logError(`Failed to parse operation ${methodName}`, error);
          continue;
        }
      }

      return operations;
    } catch (error) {
      return this.handleParsingError("parse operations", filePath, error, []);
    }
  }

  /**
   * Parse models from a Python models directory
   * Handles swagger_types, attribute_map, and enum detection
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
      const files = await this.findFiles(directoryPath, /\.py$/);

      for (const filePath of files) {
        try {
          const content = await this.readTextFile(filePath);

          // Check if file contains class definition
          if (!content.includes("class ")) {
            continue;
          }

          // Skip if it doesn't have either swagger_types or enum marker
          if (
            !content.includes("swagger_types") &&
            !content.includes("allowed enum values")
          ) {
            continue;
          }

          const model = await this.parseModel(content);
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
   * Parse basic usage information for Python SDK
   * Extracts client and configuration information
   */
  async parseBasicUsage(): Promise<BasicUsage> {
    try {
      const contentPath = this.getLanguagePath("sdk/spapi");

      const clientPath = FileSystemUtils.joinPath(contentPath, "client.py");
      const credentialsPath = FileSystemUtils.joinPath(
        contentPath,
        "auth/credentials.py",
      );
      const readme = this.getLanguagePath("README.md");

      const usage: BasicUsage = {};

      // Read client.py if it exists
      if (await this.fileExists(clientPath)) {
        try {
          usage.api_client = await this.readTextFile(clientPath);
        } catch (error) {
          this.logWarning("Failed to read client.py", { clientPath, error });
          usage.api_client = "Client file not available";
        }
      } else {
        usage.api_client = "Client file not found";
      }

      // Read credentials.py if it exists
      if (await this.fileExists(credentialsPath)) {
        try {
          usage.configuration = await this.readTextFile(credentialsPath);
        } catch (error) {
          this.logWarning("Failed to read credentials.py", {
            credentialsPath,
            error,
          });
          usage.configuration = "Configuration file not available";
        }
      } else {
        usage.configuration = "Configuration file not found";
      }
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
        "Python SDK directory",
        error as Error,
      );
    }
  }

  /**
   * Parse a single operation from method definition and docstring
   */
  private async parseOperation(
    content: string,
    methodName: string,
    className: string,
  ): Promise<Operation | null> {
    try {
      // Find the method definition line
      const methodRegex = new RegExp(`def\\s+${methodName}\\s*\\([^)]*\\):`);
      const methodMatch = content.match(methodRegex);
      if (!methodMatch) {
        return null;
      }

      // Split content by the method line to get the part after it
      const methodLine = methodMatch[0];
      const contentParts = content.split(methodLine);
      if (contentParts.length < 2) {
        return null;
      }

      const afterMethod = contentParts[1];
      let description = "No description available";
      let returnedModel = "";
      const parameters: Parameter[] = [];

      // Look for docstring in the content after the method definition
      let docstringContent = "";
      if (afterMethod.includes('"""')) {
        docstringContent = this.extractBetweenDelimiters(
          afterMethod,
          '"""',
          '"""',
        );
        if (docstringContent) {
          description = docstringContent;

          // Parse parameters from docstring - match the Python regex pattern more closely
          const lines = docstringContent.split("\n");
          for (const line of lines) {
            if (line.includes(":param ")) {
              try {
                // Extract parameter info: :param type name: description
                const paramPart = line.split(":param ")[1];
                if (!paramPart) continue;

                const colonIndex = paramPart.indexOf(":");
                if (colonIndex === -1) continue;

                const beforeColon = paramPart.substring(0, colonIndex).trim();
                const afterColon = paramPart.substring(colonIndex + 1).trim();

                // Skip async_req parameter
                if (beforeColon.includes("async_req")) {
                  continue;
                }

                // Parse "type name" format
                const parts = beforeColon.split(" ");
                if (parts.length >= 2) {
                  const paramName = parts[1];
                  const paramType = parts[0];
                  const paramDesc = afterColon;

                  const parameter: Parameter = {
                    name: paramName,
                    description: paramDesc,
                    type: paramType,
                    required: line.includes("required"),
                  };

                  parameters.push(parameter);
                }
              } catch (error) {
                // Continue processing other parameters if one fails
                this.logWarning(
                  `Failed to parse parameter from line: ${line}`,
                  { error },
                );
                continue;
              }
            }
          }

          // Extract return type
          const returnLines = lines.filter((line) => line.includes(":return:"));
          if (returnLines.length > 0) {
            const returnLine = returnLines[0];
            const returnPart = returnLine.split(":return:")[1];
            if (returnPart) {
              returnedModel = returnPart.trim();
            }
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
      this.logError(`Failed to parse operation ${methodName}`, error);
      return null;
    }
  }

  /**
   * Parse a single model from Python class definition
   */
  private async parseModel(content: string): Promise<Model | null> {
    try {
      // Extract class name - match the Python implementation pattern
      const classMatch = content.match(/^class\s+(\w+)\s*\(/m);
      if (!classMatch) {
        return null;
      }
      const className = classMatch[1];

      // Check if it's an enum by looking for "allowed enum values"
      const isEnum = content.includes("allowed enum values");
      let enumValues: string[] = [];
      let swaggerType: Record<string, string> = {};
      let attributeMap: Record<string, string> = {};

      if (isEnum) {
        // Parse enum values - match Python implementation
        const enumsTextStart = content.indexOf("allowed enum values");
        if (enumsTextStart !== -1) {
          const afterEnumText = content.substring(enumsTextStart);
          const enumSection = this.extractBetweenDelimiters(
            afterEnumText,
            '"""',
            '"""',
          );

          if (enumSection) {
            const lines = enumSection.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed && trimmed.includes(" = ")) {
                const enumValue = trimmed.split(" = ")[0].trim();
                if (enumValue) {
                  enumValues.push(enumValue);
                }
              }
            }
          }
        }
        // For enums, swagger_types and attribute_map are empty
        swaggerType = {};
        attributeMap = {};
      } else {
        // Parse swagger_types - match Python JSON parsing approach
        const swaggerTypesMatch = content.match(
          /swagger_types\s*=\s*({[\s\S]*?})/,
        );
        if (swaggerTypesMatch) {
          try {
            // Clean up the string to match Python's approach
            let swaggerTypesStr = swaggerTypesMatch[1];
            // Remove whitespace, tabs, newlines
            swaggerTypesStr = swaggerTypesStr
              .replace(/\s+/g, "")
              .replace(/\t/g, "")
              .replace(/\n/g, "");
            // Handle trailing comma before closing brace
            swaggerTypesStr = swaggerTypesStr.replace(/,}$/, "}");
            // Replace single quotes with double quotes
            swaggerTypesStr = swaggerTypesStr.replace(/'/g, '"');

            swaggerType = JSON.parse(swaggerTypesStr);
          } catch (error) {
            this.logWarning(`Failed to parse swagger_types for ${className}`, {
              error,
              content: swaggerTypesMatch[1],
            });
            swaggerType = {};
          }
        }

        // Parse attribute_map - match Python JSON parsing approach
        const attributeMapMatch = content.match(
          /attribute_map\s*=\s*({[\s\S]*?})/,
        );
        if (attributeMapMatch) {
          try {
            // Clean up the string to match Python's approach
            let attributeMapStr = attributeMapMatch[1];
            // Remove whitespace, tabs, newlines
            attributeMapStr = attributeMapStr
              .replace(/\s+/g, "")
              .replace(/\t/g, "")
              .replace(/\n/g, "");
            // Handle trailing comma before closing brace
            attributeMapStr = attributeMapStr.replace(/,}$/, "}");
            // Replace single quotes with double quotes
            attributeMapStr = attributeMapStr.replace(/'/g, '"');

            attributeMap = JSON.parse(attributeMapStr);
          } catch (error) {
            this.logWarning(`Failed to parse attribute_map for ${className}`, {
              error,
              content: attributeMapMatch[1],
            });
            attributeMap = {};
          }
        }
      }

      const model: Model = {
        name: className,
        swaggerType,
        attributeMap,
        isEnum,
        ...(isEnum && enumValues.length > 0 ? { enumValues } : {}),
      };

      return model;
    } catch (error) {
      this.logError("Failed to parse model", error);
      return null;
    }
  }
}
