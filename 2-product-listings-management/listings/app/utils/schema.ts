import { Generate, JsonSchema7 } from "@jsonforms/core";
import { cloneDeep } from "lodash";
import { v4 as uuid } from "uuid";
import Ajv, { ErrorObject } from "ajv";

const ID_SUFFIX = "/Augmented";

/**
 * This function removes some elements from the schema returned by the API in
 * order to generate the UI properly.
 * @param schema
 */
export function cleanUpSchemaForPresentation(schema: JsonSchema7) {
  const clonedSchema: JsonSchema7 = cloneDeep(schema);
  delete clonedSchema.allOf;
  delete clonedSchema.anyOf;
  delete clonedSchema.oneOf;
  const schemaId = clonedSchema.$id || uuid();
  if (!schemaId.includes(ID_SUFFIX)) {
    clonedSchema.$id = schemaId + ID_SUFFIX;
  }
  return clonedSchema;
}

/**
 * Generates the UI schema for the given schema.
 * @param schema
 */
export function generateUISchema(schema: JsonSchema7) {
  return Generate.uiSchema(cleanUpSchemaForPresentation(schema));
}

/**
 * Cleans up the listing in the Attribute form.
 * @param data
 */
export function cleanUpListing(data: any) {
  if (data === null || data === undefined) {
    return undefined;
  }

  if (typeof data === "string") {
    return !data?.length ? undefined : data;
  }

  if (Array.isArray(data)) {
    const filteredItems: any = (data as Array<any>)
      .map((value: any) => cleanUpListing(value))
      .filter((value) => value !== undefined);
    return !filteredItems?.length ? undefined : Array.from(filteredItems);
  }

  if (data instanceof Object) {
    const filteredEntries: any = Object.entries(data)
      .map(([key, value]) => [key, cleanUpListing(value)])
      .filter(([key, value]) => value !== undefined);
    return !filteredEntries?.length
      ? undefined
      : Object.fromEntries(filteredEntries);
  }

  return data;
}

/**
 * A common function which is used to clone and cleanup a listing. This method
 * is used by both the Json Listing Feed and Listings Item API submission
 * scenarios.
 * @param data the listing data.
 */
export function cloneAndCleanupListing(data: any) {
  return cleanUpListing(cloneDeep(data)) || {};
}

/**
 * Validates the given data with the given schema using the given validator.
 * @param validator the Ajv validator for the validation.
 * @param schema the schema for the validation.
 * @param data the data to be validated.
 */
export function validateDataWithSchema(
  validator: Ajv,
  schema: JsonSchema7,
  data: any,
): ErrorObject[] {
  const validateFunction = validator.getSchema(schema.$id || "");
  if (validateFunction) {
    // This implies the schema is already compiled by the validator.
    // Validate the data using the helper function from the compiled schema.
    return !validateFunction(data) && validateFunction.errors
      ? validateFunction.errors
      : [];
  } else {
    // This implies the schema is not yet compiled by the validator.
    // Invoke the validate method which compiles the schema and validates the
    // data.
    return !validator.validate(schema, data) && validator.errors
      ? validator.errors
      : [];
  }
}
