import { BaseParser, BasicUsage } from "./base-parser.js";
import { Category, Operation, Model, Parameter } from "../models/index.js";
import { FileSystemUtils } from "../../../utils/file-system.js";
import {
  ErrorHandlingUtils,
  ErrorCode,
} from "../../../utils/error-handling.js";

/**
 * Java language parser for Amazon Selling Partner API SDK
 * Parses Java SDK files to extract categories, operations, models, and usage information
 */
export class JavaParser extends BaseParser {
  constructor(repositoryPath: string) {
    super(repositoryPath, "java");
  }

  /**
   * Parse SDK categories from Java API files
   * Traverses the Java SDK API directory and extracts category information
   */
  async parseCategories(): Promise<Category[]> {
    try {
      const apiPath = this.getLanguagePath(
        "sdk/src/main/java/software/amazon/spapi/api",
      );

      if (!(await this.directoryExists(apiPath))) {
        throw ErrorHandlingUtils.createError(
          ErrorCode.FILE_NOT_FOUND,
          `Java API directory not found: ${apiPath}`,
          {
            apiPath,
            language: this.language,
          },
        );
      }

      const categories: Category[] = [];
      const files = await this.findFiles(apiPath, /\.java$/);

      for (const filePath of files) {
        try {
          const content = await this.readTextFile(filePath);

          // Check if file contains class definition and comment block
          if (!content.includes("*/") || !content.includes("public class ")) {
            continue;
          }

          // Extract class name
          const classMatch = content.match(/public class\s+(\w+)\s+/);
          if (!classMatch) {
            continue;
          }
          const className = classMatch[1];

          // Extract package name
          const packageMatch = content.match(/package\s+([^;]+);/);
          if (!packageMatch) {
            continue;
          }
          const packageName = packageMatch[1];

          // Extract description from comment block
          const description = this.extractBetweenDelimiters(
            content,
            "/*",
            "*/",
          );

          // Extract category from path
          const relativePath = FileSystemUtils.getRelativePath(
            apiPath,
            filePath,
          );
          const category = FileSystemUtils.getDirname(relativePath);

          // Build paths
          const modelsPath = filePath
            .replace("/api/", "/models/")
            .replace(`/${FileSystemUtils.getBasename(filePath)}`, "");
          const importPath = `import ${packageName}.${className};`;

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
        "Java API directory",
        error as Error,
      );
    }
  }

  /**
   * Parse operations from a specific Java API file
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

      if (!content.includes("public class ")) {
        return [];
      }

      const operations: Operation[] = [];

      // Extract class name
      const classMatch = content.match(/public class\s+(\w+)\s+/);
      if (!classMatch) {
        return [];
      }
      const className = classMatch[1];

      // Split by /** to find javadoc comments
      const javadocSections = content.split("/**");

      for (let i = 1; i < javadocSections.length; i++) {
        try {
          const section = javadocSections[i];

          if (!section.includes("*/")) {
            continue;
          }

          const operation = await this.parseJavaOperation(section, className);
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
   * Parse models from a Java models directory
   * Handles swagger types, attribute maps, and enum detection
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
      const files = await this.findFiles(directoryPath, /\.java$/);

      for (const filePath of files) {
        try {
          const content = await this.readTextFile(filePath);

          // Check if file contains class or enum definition
          if (
            !content.includes("public class") &&
            !content.includes("public enum")
          ) {
            continue;
          }

          const model = await this.parseJavaModel(content);
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
   * Parse basic usage information for Java SDK
   * Extracts client and configuration information
   */
  async parseBasicUsage(): Promise<BasicUsage> {
    try {
      const authPath = this.getLanguagePath(
        "sdk/src/main/java/com/amazon/SellingPartnerAPIAA",
      );

      if (!(await this.directoryExists(authPath))) {
        return {};
      }

      const usage: BasicUsage = {};
      const files = await this.findFiles(authPath, /\.java$/);

      for (const filePath of files) {
        try {
          const fileName = FileSystemUtils.getBasename(filePath, ".java");
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
        "Java SDK directory",
        error as Error,
      );
    }
  }

  /**
   * Parse a single Java operation from javadoc and method definition
   */
  private async parseJavaOperation(
    section: string,
    className: string,
  ): Promise<Operation | null> {
    try {
      if (!section.includes("*/")) {
        return null;
      }

      // Split into javadoc and method parts
      const parts = section.split("*/");
      if (parts.length < 2) {
        return null;
      }

      const javadoc = parts[0];
      const methodPart = parts[1];

      // Extract method name
      const methodMatch = methodPart.match(/(\w+)\s*\(/);
      if (!methodMatch) {
        return null;
      }
      const methodName = methodMatch[1];

      // Extract method signature for parameter parsing
      const signatureMatch = methodPart.match(/\(([^)]*)\)/);
      const methodSignature = signatureMatch ? signatureMatch[1] : "";

      // Parse javadoc
      let description = "No description available";
      let returnedModel = "";
      const parameters: Parameter[] = [];

      const javadocLines = javadoc.split("\n");

      // Extract description (first non-empty lines before @param or @return)
      const descriptionLines: string[] = [];
      for (const line of javadocLines) {
        const trimmed = line.trim().replace(/^\*\s*/, "");
        if (trimmed.startsWith("@")) {
          break;
        }
        if (trimmed) {
          descriptionLines.push(trimmed);
        }
      }
      if (descriptionLines.length > 0) {
        description = descriptionLines
          .join(" ")
          .split("&#x60;x-amzn-RateLimit-Limit&#x60;")[0];
      }

      // Parse @param and @return tags
      for (const line of javadocLines) {
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

            const spaceIndex = paramPart.indexOf(" ");
            if (spaceIndex === -1) continue;

            const paramName = paramPart.substring(0, spaceIndex);
            const paramDesc = paramPart.substring(spaceIndex + 1);

            // Extract parameter type from method signature
            let paramType = "Object";
            if (methodSignature.includes(paramName)) {
              const beforeParam = methodSignature.split(paramName)[0];
              const typeMatch = beforeParam.match(/(\w+)\s*$/);
              if (typeMatch) {
                paramType = typeMatch[1];
              } else if (beforeParam.includes(",")) {
                const lastComma = beforeParam.lastIndexOf(",");
                const afterComma = beforeParam.substring(lastComma + 1).trim();
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
        callMethod: `${className}.${methodName}`,
        returnedModel: returnedModel || "Unknown",
        rateLimit,
        ...(parameters.length > 0 ? { inputParameters: parameters } : {}),
      };

      return operation;
    } catch (error) {
      this.logError(`Failed to parse Java operation`, error);
      return null;
    }
  }

  /**
   * Parse a single Java model from class or enum definition
   */
  private async parseJavaModel(content: string): Promise<Model | null> {
    try {
      const lines = content.split("\n");
      let name = "";
      let swaggerType: Record<string, string> = {};
      let attributeMap: Record<string, string> = {};
      let isEnum = false;
      let enumValues: string[] = [];

      // Check if it's an enum
      if (content.includes("\npublic enum")) {
        isEnum = true;
        const enumMatch = content.match(/\npublic enum\s+(\w+)\s+/);
        if (enumMatch) {
          name = enumMatch[1];
        }

        // Parse enum values
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes("@SerializedName")) {
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1];
              const enumMatch = nextLine.match(/(\w+)\s*\(/);
              if (enumMatch) {
                enumValues.push(
                  enumMatch[1].replace(/\t/g, "").replace(/\s/g, ""),
                );
              }
            }
          }
        }
      } else if (content.includes("\npublic class")) {
        // Regular class
        const classMatch = content.match(/\npublic class\s+(\w+)\s+/);
        if (classMatch) {
          name = classMatch[1];
        }

        // Parse @SerializedName annotations for swagger types and attribute map
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes("@SerializedName")) {
            const serializedMatch = line.match(/@SerializedName\("([^"]+)"\)/);
            if (serializedMatch && i + 1 < lines.length) {
              const serializedName = serializedMatch[1];
              const nextLine = lines[i + 1];

              // Extract field name and type
              const fieldMatch = nextLine.match(
                /(?:private|public|protected)\s+(\S+)\s+(\w+)\s*=/,
              );
              if (fieldMatch) {
                const fieldType = fieldMatch[1];
                const fieldName = fieldMatch[2];

                swaggerType[fieldName] = fieldType;
                attributeMap[fieldName] = serializedName;
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
      this.logError("Failed to parse Java model", error);
      return null;
    }
  }
}
