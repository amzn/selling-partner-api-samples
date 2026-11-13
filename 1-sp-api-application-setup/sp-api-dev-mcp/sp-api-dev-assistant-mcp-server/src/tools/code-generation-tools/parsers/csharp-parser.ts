import path from "path";
import { BaseParser, BasicUsage } from "./base-parser.js";
import { Category, Operation, Model, Parameter } from "../models/index.js";
import {
  ErrorHandlingUtils,
  ErrorCode,
} from "../../../utils/error-handling.js";

/**
 * C# language parser for Amazon Selling Partner API SDK
 * Parses C# SDK files to extract categories, operations, models, and usage information
 */
export class CSharpParser extends BaseParser {
  constructor(repositoryPath: string) {
    super(repositoryPath, "csharp");
  }

  /**
   * Parse SDK categories from C# API files
   * Traverses the C# SDK API directory and extracts category information
   */
  async parseCategories(): Promise<Category[]> {
    try {
      const apiPath = this.getLanguagePath("sdk/src/software.amzn.spapi");

      if (!(await this.directoryExists(apiPath))) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.FILE_NOT_FOUND,
          `C# API directory not found: ${apiPath}`,
          {
            apiPath,
            language: this.language,
          },
        );
      }

      const categories: Category[] = [];
      const files = await this.findFiles(apiPath, /\.cs$/);

      for (const filePath of files) {
        try {
          // Only process files that contain "Api." in the path
          if (!filePath.includes("Api.")) {
            continue;
          }

          const content = await this.readTextFile(filePath);

          // Check if file contains partial class definition
          if (!content.includes("public partial class ")) {
            continue;
          }

          // Extract class name
          const classMatch = content.match(/public partial class\s+(\w+)\s+/);
          if (!classMatch) {
            continue;
          }
          const className = classMatch[1];

          // Extract namespace
          const namespaceMatch = content.match(/namespace\s+([^\n\r]+)/);
          if (!namespaceMatch) {
            continue;
          }
          const packageName = namespaceMatch[1].trim();

          // Extract description from comment block
          const description = this.extractBetweenDelimiters(
            content,
            "/*",
            "*/",
          );

          // Build paths - use directory only for modelsPath since models are in a directory, not a single file
          const modelsPath = path.dirname(filePath).replace("Api.", "Model.");
          const importPath = `using ${packageName}`;

          const category: Category = {
            name: className,
            description: description || "No description available",
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

      return categories;
    } catch (error) {
      throw this.createParsingError(
        "parse categories",
        "C# API directory",
        error as Error,
      );
    }
  }

  /**
   * Parse operations from a specific C# API file
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

      if (!content.includes("public partial class ")) {
        return [];
      }

      const operations: Operation[] = [];

      // Extract class name
      const classMatch = content.match(/public partial class\s+(\w+)\s+/);
      if (!classMatch) {
        return [];
      }
      const className = classMatch[1];

      // Find the class content after the class declaration
      const classContent = content.split("public partial class ")[1];

      // Split by <summary> to find XML documentation comments
      const summarySections = classContent.split("<summary>");

      for (let i = 1; i < summarySections.length; i++) {
        try {
          const section = summarySections[i];

          if (!section.includes("</summary>")) {
            continue;
          }

          const operation = await this.parseCSharpOperation(section, className);
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
   * Parse models from a C# models directory
   * Handles DataMember attributes and enum detection
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
      const files = await this.findFiles(directoryPath, /\.cs$/);

      for (const filePath of files) {
        try {
          // Skip OpenAPISchema files
          if (filePath.includes("OpenAPISchema")) {
            continue;
          }

          const content = await this.readTextFile(filePath);

          const model = await this.parseCSharpModel(content, filePath);
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
   * Parse basic usage information for C# SDK
   * Extracts API client information
   */
  async parseBasicUsage(): Promise<BasicUsage> {
    try {
      // Note: The original Python code has a hardcoded path, but we'll try to find it dynamically
      const clientPath = this.getLanguagePath(
        "sdk/src/software.amzn.spapi/Client/ApiClient.cs",
      );

      const usage: BasicUsage = {};

      if (await this.fileExists(clientPath)) {
        try {
          const content = await this.readTextFile(clientPath);
          usage.apiClient = content;
        } catch (error) {
          this.logWarning("Failed to read ApiClient.cs", { clientPath, error });
          usage.apiClient = "ApiClient file not available";
        }
      } else {
        usage.apiClient = "ApiClient file not found";
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
        "C# SDK directory",
        error as Error,
      );
    }
  }

  /**
   * Parse a single C# operation from XML documentation and method definition
   */
  private async parseCSharpOperation(
    section: string,
    className: string,
  ): Promise<Operation | null> {
    try {
      if (!section.includes("</summary>")) {
        return null;
      }

      // Extract description from <summary> tag
      const summaryMatch = section.match(/^([^<]*)<\/summary>/);
      if (!summaryMatch) {
        return null;
      }
      const description = summaryMatch[1]
        .replace(/\/\/\//g, "")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Find method definition after the XML documentation
      // Look for a public method declaration line following the doc comments
      const methodSectionMatch = section.match(
        /\n\s*(?:\[.*\]\s*\n\s*)*public\s+\S+\s+(\w+)\s*\(/,
      );
      if (!methodSectionMatch) {
        return null;
      }

      const methodName = methodSectionMatch[1];

      // Skip internal/utility methods that aren't API operations
      if (methodName.endsWith("WithHttpInfo") || methodName.endsWith("Async")) {
        return null;
      }

      // Only include methods that have ApiException documentation (actual API operations)
      if (!section.includes("ApiException")) {
        return null;
      }

      // Extract method signature for parameter parsing
      const signatureMatch = section.match(/\(([^)]*)\)/);
      const methodSignature = signatureMatch ? signatureMatch[1] : "";

      // Parse XML documentation
      let returnedModel = "";
      const parameters: Parameter[] = [];

      const lines = section.split("\n");

      // Parse <returns> and <param> tags
      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.includes("<returns>")) {
          const returnsMatch = trimmed.match(/<returns>([^<]*)<\/returns>/);
          if (returnsMatch) {
            returnedModel = returnsMatch[1];
          }
        } else if (trimmed.includes("<param ")) {
          try {
            const paramMatch = trimmed.match(
              /<param name="([^"]+)">([^<]*)<\/param>/,
            );
            if (paramMatch) {
              const paramName = paramMatch[1];
              const paramDesc = paramMatch[2];

              // Extract parameter type from method signature
              let paramType = "object";
              if (methodSignature.includes(paramName)) {
                const beforeParam = methodSignature.split(paramName)[0];
                const typeMatch = beforeParam.match(/(\w+)\s*$/);
                if (typeMatch) {
                  paramType = typeMatch[1];
                } else if (beforeParam.includes(",")) {
                  const lastComma = beforeParam.lastIndexOf(",");
                  const afterComma = beforeParam
                    .substring(lastComma + 1)
                    .trim();
                  const typeMatch2 = afterComma.match(/(\w+)\s*$/);
                  if (typeMatch2) {
                    paramType = typeMatch2[1];
                  }
                } else {
                  // First parameter
                  const afterParen = beforeParam.replace(/^\s*/, "");
                  const typeMatch3 = afterParen.match(/^(\w+)/);
                  if (typeMatch3) {
                    paramType = typeMatch3[1];
                  }
                }
              }

              const parameter: Parameter = {
                name: paramName,
                description: paramDesc,
                type: paramType
                  .replace(/\s+/g, "")
                  .replace(/\n/g, "")
                  .replace(/\t/g, ""),
                required: !trimmed.includes("optional"),
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
      this.logError(`Failed to parse C# operation`, error);
      return null;
    }
  }

  /**
   * Parse a single C# model from class or enum definition
   */
  private async parseCSharpModel(
    content: string,
    filePath: string,
  ): Promise<Model | null> {
    try {
      let name = "";
      let swaggerType: Record<string, string> = {};
      let attributeMap: Record<string, string> = {};
      let isEnum = false;
      let enumValues: string[] = [];

      // Check if it's an enum
      if (content.includes("public enum")) {
        const enumMatch = content.match(/public enum\s+(\w+)\s+/);
        if (enumMatch) {
          name = enumMatch[1];

          // Verify the enum name is in the file path
          if (filePath.includes(name)) {
            isEnum = true;

            // Parse enum values from <summary> sections with EnumMember
            const summarySections = content.split("<summary>");

            for (const section of summarySections) {
              if (section.includes("EnumMember")) {
                const enumMatch = section.match(/"([^"]+)"/);
                if (enumMatch) {
                  enumValues.push(enumMatch[1]);
                }
              }
            }
          }
        }
      } else if (content.includes("public partial class ")) {
        // Regular class
        const classMatch = content.match(/public partial class\s+(\w+)\s+/);
        if (classMatch) {
          name = classMatch[1];
        }

        // Parse DataMember attributes
        const summarySections = content.split("<summary>");

        for (const section of summarySections) {
          if (section.includes("DataMember")) {
            try {
              const nameMatch = section.match(/Name = "([^"]+)"/);
              if (nameMatch) {
                const memberName = nameMatch[1];

                // Find the property type
                const publicMatch = section.match(/public\s+(\w+)\s+/);
                if (publicMatch) {
                  const memberType = publicMatch[1];

                  swaggerType[memberName] = memberType;
                  attributeMap[memberName] = memberName;
                }
              }
            } catch (error) {
              this.logWarning(`Failed to parse DataMember in section`, {
                error,
              });
              continue;
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
      this.logError("Failed to parse C# model", error);
      return null;
    }
  }
}
