import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Property 5: Validation rejects forms with empty required fields
 * **Validates: Requirements 5.1, 5.2**
 *
 * For any rendered form where one or more required fields (as defined in the schema's
 * required arrays) have empty values, the validation SHALL fail, prevent submission,
 * and display an inline error message next to each empty required field.
 *
 * This test reimplements the core validation logic from public/app.js as pure functions
 * to verify the algorithmic correctness of required-field detection and validation.
 */

// ========== Reimplemented core logic from public/app.js ==========

interface PathSegment {
  name?: string;
  isIndex?: boolean;
  index?: number;
}

interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  examples?: unknown[];
}

/**
 * Parses a data-path string into segments.
 * Mirrors parseDataPath from app.js.
 */
function parseDataPath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const parts = path.split(".");

  for (const part of parts) {
    const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
    if (arrayMatch) {
      segments.push({ name: arrayMatch[1] });
      segments.push({ isIndex: true, index: parseInt(arrayMatch[2], 10) });
    } else {
      segments.push({ name: part });
    }
  }

  return segments;
}

/**
 * Resolves the effective type from a JSON Schema property.
 * Mirrors resolveSchemaType from app.js.
 */
function resolveSchemaType(propSchema: JsonSchema | undefined): string {
  if (!propSchema || !propSchema.type) return "string";
  if (Array.isArray(propSchema.type)) {
    return propSchema.type.find((t) => t !== "null") || "string";
  }
  return propSchema.type;
}

/**
 * Determines if a field is required based on the schema's required arrays at each nesting level.
 * Mirrors isFieldRequired from app.js.
 */
function isFieldRequired(schema: JsonSchema, path: string): boolean {
  const segments = parseDataPath(path);
  let currentSchema: JsonSchema = schema;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (segment.isIndex) {
      if (currentSchema && resolveSchemaType(currentSchema) === "array" && currentSchema.items) {
        currentSchema = currentSchema.items;
      } else {
        return false;
      }
      continue;
    }

    if (i === segments.length - 1) {
      const requiredList = Array.isArray(currentSchema.required) ? currentSchema.required : [];
      return requiredList.includes(segment.name!);
    }

    if (currentSchema.properties && currentSchema.properties[segment.name!]) {
      const propSchema = currentSchema.properties[segment.name!];
      const type = resolveSchemaType(propSchema);
      if (type === "object") {
        currentSchema = propSchema;
      } else if (type === "array" && propSchema.items) {
        currentSchema = propSchema;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  return false;
}

/**
 * Simulates the validation logic from validateForm in app.js.
 * Given a schema and a map of field paths to their values,
 * returns the set of field paths that have validation errors.
 */
function validateFormFields(schema: JsonSchema, fieldValues: Map<string, string>): Set<string> {
  const errors = new Set<string>();

  for (const [path, value] of fieldValues) {
    const required = isFieldRequired(schema, path);
    if (required) {
      const trimmed = value.trim();
      if (!trimmed) {
        errors.add(path);
      }
    }
  }

  return errors;
}

// ========== Arbitraries ==========

/** Generate a valid property name (simple camelCase identifier) */
const arbPropertyName = fc
  .tuple(
    fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")),
    fc.array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")), { minLength: 1, maxLength: 8 }),
  )
  .map(([first, rest]) => first + rest.join(""));

/** Generate a schema with 1-5 string properties and a varying required subset */
const arbFlatSchema = fc
  .array(arbPropertyName, { minLength: 1, maxLength: 5 })
  .chain((propNames) => {
    // Ensure unique property names
    const uniqueNames = [...new Set(propNames)];
    if (uniqueNames.length === 0) return fc.constant({ schema: { type: "object", properties: {}, required: [] } as JsonSchema, allFields: [] as string[] });

    // Generate a subset to mark as required (at least 1 required)
    return fc.subarray(uniqueNames, { minLength: 1 }).map((requiredFields) => {
      const properties: Record<string, JsonSchema> = {};
      for (const name of uniqueNames) {
        properties[name] = { type: "string" };
      }
      const schema: JsonSchema = {
        type: "object",
        properties,
        required: requiredFields,
      };
      return { schema, allFields: uniqueNames };
    });
  });

/** Generate a schema with nested object containing required fields */
const arbNestedSchema = fc
  .tuple(
    arbPropertyName, // parent property name
    fc.array(arbPropertyName, { minLength: 1, maxLength: 4 }), // child property names
  )
  .chain(([parentName, childNames]) => {
    const uniqueChildren = [...new Set(childNames)];
    if (uniqueChildren.length === 0) {
      return fc.constant({
        schema: { type: "object", properties: { [parentName]: { type: "object", properties: {}, required: [] } }, required: [parentName] } as JsonSchema,
        nestedFields: [] as string[],
        nestedRequired: [] as string[],
        parentName,
      });
    }

    return fc.subarray(uniqueChildren, { minLength: 1 }).map((requiredChildren) => {
      const childProperties: Record<string, JsonSchema> = {};
      for (const name of uniqueChildren) {
        childProperties[name] = { type: "string" };
      }
      const schema: JsonSchema = {
        type: "object",
        properties: {
          [parentName]: {
            type: "object",
            properties: childProperties,
            required: requiredChildren,
          },
        },
        required: [parentName],
      };
      return {
        schema,
        nestedFields: uniqueChildren.map((child) => `${parentName}.${child}`),
        nestedRequired: requiredChildren.map((child) => `${parentName}.${child}`),
        parentName,
      };
    });
  });

/**
 * Given a list of fields and a subset that must be empty, generates a fieldValues map
 * where the empty-subset fields have empty/whitespace values and others have non-empty values.
 */
function arbFieldValues(allFields: string[], emptyFields: string[]) {
  return fc.tuple(...allFields.map((field) => (emptyFields.includes(field) ? fc.constantFrom("", "  ", "\t") : fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0)))).map((values) => {
    const map = new Map<string, string>();
    allFields.forEach((field, i) => {
      map.set(field, values[i]);
    });
    return map;
  });
}

// ========== Property Tests ==========

describe("Notification Validation Property Tests", () => {
  describe("Property 5: Validation rejects forms with empty required fields", () => {
    it("Property 5a: Validation identifies all empty required fields in a flat schema", () => {
      fc.assert(
        fc.property(
          arbFlatSchema.chain(({ schema, allFields }) => {
            const requiredFields = schema.required || [];
            // Pick at least 1 required field to be empty
            return fc.subarray(requiredFields, { minLength: 1 }).chain((emptyRequired) => {
              return arbFieldValues(allFields, emptyRequired).map((fieldValues) => ({
                schema,
                allFields,
                emptyRequired,
                fieldValues,
              }));
            });
          }),
          ({ schema, emptyRequired, fieldValues }) => {
            const errors = validateFormFields(schema, fieldValues);

            // All empty required fields must be identified as errors
            for (const field of emptyRequired) {
              expect(errors.has(field), `Expected error for empty required field "${field}"`).toBe(true);
            }

            // Validation must fail (at least one error)
            expect(errors.size).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("Property 5b: Validation does not flag non-empty required fields as errors", () => {
      fc.assert(
        fc.property(
          arbFlatSchema.chain(({ schema, allFields }) => {
            const requiredFields = schema.required || [];
            // Pick a subset to be empty (could be empty subset — all filled)
            return fc.subarray(requiredFields).chain((emptyRequired) => {
              return arbFieldValues(allFields, emptyRequired).map((fieldValues) => ({
                schema,
                allFields,
                requiredFields,
                emptyRequired,
                fieldValues,
              }));
            });
          }),
          ({ schema, requiredFields, emptyRequired, fieldValues }) => {
            const errors = validateFormFields(schema, fieldValues);

            // Required fields that are NOT empty should NOT have errors
            const filledRequired = requiredFields.filter((f) => !emptyRequired.includes(f));
            for (const field of filledRequired) {
              expect(errors.has(field), `Field "${field}" is filled but was flagged as error`).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("Property 5c: Validation does not flag non-required empty fields as errors", () => {
      fc.assert(
        fc.property(
          arbFlatSchema.chain(({ schema, allFields }) => {
            const requiredFields = schema.required || [];
            const nonRequired = allFields.filter((f) => !requiredFields.includes(f));
            // Make all non-required fields empty, and fill all required fields
            return arbFieldValues(allFields, nonRequired).map((fieldValues) => ({
              schema,
              nonRequired,
              fieldValues,
            }));
          }),
          ({ schema, nonRequired, fieldValues }) => {
            const errors = validateFormFields(schema, fieldValues);

            // Non-required fields should never produce required-field errors
            for (const field of nonRequired) {
              expect(errors.has(field), `Non-required field "${field}" should not be flagged`).toBe(false);
            }

            // With all required fields filled, validation should pass
            expect(errors.size).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("Property 5d: Validation correctly identifies empty required fields in nested schemas", () => {
      fc.assert(
        fc.property(
          arbNestedSchema.chain(({ schema, nestedFields, nestedRequired }) => {
            // Pick at least 1 nested required field to be empty
            return fc.subarray(nestedRequired, { minLength: 1 }).chain((emptyRequired) => {
              return arbFieldValues(nestedFields, emptyRequired).map((fieldValues) => ({
                schema,
                nestedFields,
                nestedRequired,
                emptyRequired,
                fieldValues,
              }));
            });
          }),
          ({ schema, emptyRequired, fieldValues }) => {
            const errors = validateFormFields(schema, fieldValues);

            // All empty required nested fields must be identified as errors
            for (const field of emptyRequired) {
              expect(errors.has(field), `Expected error for empty required nested field "${field}"`).toBe(true);
            }

            // Validation must fail
            expect(errors.size).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("Property 5e: The set of error fields equals exactly the set of empty required fields", () => {
      fc.assert(
        fc.property(
          arbFlatSchema.chain(({ schema, allFields }) => {
            const requiredFields = schema.required || [];
            // Pick a random subset of required fields to leave empty
            return fc.subarray(requiredFields, { minLength: 1 }).chain((emptyRequired) => {
              return arbFieldValues(allFields, emptyRequired).map((fieldValues) => ({
                schema,
                emptyRequired,
                fieldValues,
              }));
            });
          }),
          ({ schema, emptyRequired, fieldValues }) => {
            const errors = validateFormFields(schema, fieldValues);

            // The errors set should be EXACTLY the empty required fields
            const expectedErrors = new Set(emptyRequired);
            expect(errors).toEqual(expectedErrors);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
