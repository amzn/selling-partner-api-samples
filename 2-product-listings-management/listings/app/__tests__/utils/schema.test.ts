import {
  cleanUpListing,
  cleanUpSchemaForPresentation,
} from "@/app/utils/schema";
import { MOCK_SCHEMA } from "@/app/test-utils/mock-schema";

describe("Test for the cleanUpSchemaForPresentation", () => {
  test("verifies if all the combinator keys are removed.", () => {
    const cleanedUpSchema = cleanUpSchemaForPresentation(MOCK_SCHEMA);
    expect(cleanedUpSchema.anyOf).toBeUndefined();
    expect(cleanedUpSchema.allOf).toBeUndefined();
    expect(cleanedUpSchema.oneOf).toBeUndefined();
    expect(cleanedUpSchema.$id).toContain("Augmented");
  });
});

describe("Test for the cleanUpListing", () => {
  test("snapshot test for the cleanUpListing", () => {
    const listing = {
      item_name: [
        {
          value: "",
          marketplace_id: undefined,
        },
      ],
      description: [
        {
          value: {
            marketplace_id: undefined,
          },
          alternateValue: {
            value: 1234,
          },
        },
      ],
    };
    expect(cleanUpListing(listing)).toMatchSnapshot();
  });
});
