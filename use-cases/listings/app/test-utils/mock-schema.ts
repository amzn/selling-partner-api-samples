/**
 * Mock Schema which can be used across tests. The schema will be filled
 * with more content as needed.
 */
export const MOCK_SCHEMA = {
  $schema:
    "https://schemas.amazon.com/selling-partners/definitions/product-types/meta-schema/v1",
  $id: "https://schemas.amazon.com/selling-partners/definitions/product-types/schema/v1/LUGGAGE",
  properties: {
    name: {
      type: "string",
      minLength: 3,
      description: "Please enter your name",
    },
    birthDate: {
      type: "string",
      format: "date",
    },
    occupation: {
      type: "string",
    },
  },
  required: ["name", "birthDate"],
  anyOf: [
    {
      type: "string",
    },
    {
      type: "string",
      enum: ["ATVPDKIKX0DER"],
      enumNames: ["Amazon.com"],
    },
  ],
  allOf: [
    {
      required: ["fulfillment_channel_code"],
      properties: {
        fulfillment_channel_code: {
          enum: ["DEFAULT"],
        },
      },
    },
    {
      not: {
        required: ["quantity"],
      },
    },
  ],
  oneOf: [
    {
      type: "string",
    },
    {
      type: "string",
      enum: ["ATVPDKIKX0DER"],
      enumNames: ["Amazon.com"],
    },
  ],
};
