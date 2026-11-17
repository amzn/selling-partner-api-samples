import {
  computePatches,
  convertListingToJsonFeed,
} from "@/app/utils/json-feed";
import { serializeToJsonString } from "@/app/utils/serialization";
import {
  CREATE_LISTING_USE_CASE,
  CREATE_OFFER_USE_CASE,
  PATCH_LISTINGS_ITEM_API_NAME,
  UPDATE_LISTING_USE_CASE,
} from "@/app/constants/global";

const SKU: string = "SKU";
const PRODUCT_TYPE: string = "SHIRT";
const SELLER_ID: string = "ATVPDKIKX0DER";
const ISSUE_LOCALE: string = "en_US";
const CURRENT_LISTING = {
  item_name: [
    {
      value: "Title",
      marketplace_id: "ATVPDKIKX0DER",
    },
  ],
};
const EMPTY_INITIAL_LISTING = {};

describe("Test for the Json Feed", () => {
  test("verify the converted feed content for CreateOffer use case", async () => {
    const feed = convertListingToJsonFeed(
      SKU,
      PRODUCT_TYPE,
      CURRENT_LISTING,
      CREATE_OFFER_USE_CASE,
      EMPTY_INITIAL_LISTING,
      SELLER_ID,
      ISSUE_LOCALE,
    );
    expect(serializeToJsonString(feed)).toMatchSnapshot();
  });

  test("verify the converted feed content for CreateListing use case ", async () => {
    const feed = convertListingToJsonFeed(
      SKU,
      PRODUCT_TYPE,
      CURRENT_LISTING,
      CREATE_LISTING_USE_CASE,
      EMPTY_INITIAL_LISTING,
      SELLER_ID,
      ISSUE_LOCALE,
    );
    expect(serializeToJsonString(feed)).toMatchSnapshot();
  });

  test("verify the converted feed content for UpdateListing use case ", async () => {
    const feed = convertListingToJsonFeed(
      SKU,
      PRODUCT_TYPE,
      {
        keyAdded: [
          {
            value: "keyAdded",
          },
        ],
        keyUnChanged: [
          {
            value: "keyUnChanged1",
            keywords: ["Keyword1", "KeyWord2"],
          },
          {
            value: "keyUnChanged2",
            keywords: ["Keyword3", "KeyWord4"],
          },
        ],
        keyChanged: [
          {
            value: "keyUnChanged",
          },
        ],
      },

      UPDATE_LISTING_USE_CASE,
      {
        keyRemoved: [
          {
            value: "keyRemoved",
          },
        ],
        keyUnChanged: [
          {
            value: "keyUnChanged1",
            keywords: ["Keyword1", "KeyWord2"],
          },
          {
            value: "keyUnChanged2",
            keywords: ["Keyword3", "KeyWord4"],
          },
        ],
        keyChanged: [
          {
            value: "keyUnChanged1",
          },
        ],
      },
      SELLER_ID,
      ISSUE_LOCALE,
      PATCH_LISTINGS_ITEM_API_NAME,
    );
    expect(serializeToJsonString(feed)).toMatchSnapshot();
  });

  test("returned undefined on empty attributes for CreateOffer usecase", () => {
    const feed = convertListingToJsonFeed(
      SKU,
      PRODUCT_TYPE,
      {},
      "CreateOfferListing",
      {},
      SELLER_ID,
      ISSUE_LOCALE,
    );
    expect(feed).toBeUndefined();
  });

  test("returned undefined on empty patches for UpdateListing usecase", () => {
    const listing = {
      item_name: [
        {
          value: "Title",
        },
      ],
    };
    const feed = convertListingToJsonFeed(
      SKU,
      PRODUCT_TYPE,
      listing,
      "CreateOfferListing",
      listing,
      SELLER_ID,
      ISSUE_LOCALE,
      PATCH_LISTINGS_ITEM_API_NAME,
    );
    expect(feed).toBeUndefined();
  });

  test("computePatches creates a patch for the first common attribute", () => {
    const listing = {
      item_name: [
        {
          value: "Title",
        },
      ],
    };
    const initialListing = {
      item_name: [
        {
          value: "Title1",
        },
      ],
    };
    const patches = computePatches(listing, initialListing);
    expect(patches?.length).toStrictEqual(1);
    expect(patches[0]).toMatchSnapshot();
  });
});
