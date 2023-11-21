export const MOCK_DELETE_LISTINGS_ITEM_API_SUCCESS_RESPONSE = {
  sku: "My SKU",
  status: "ACCEPTED",
  submissionId: "Some UUID",
};

export const MOCK_GET_LISTINGS_ITEM_API_SUCCESS_RESPONSE = {
  sku: "S014-A03",
  summaries: [
    {
      marketplaceId: "ATVPDKIKX0DER",
      asin: "B003VDOHBG",
      productType: "SUNGLASSES",
      conditionType: "new_new",
      status: [],
      itemName:
        "SKAGEN DENMARK Unisex Sunglasses Steel Aviator Frame #S014-A03",
      createdDate: "2023-02-10T01:29:04.021Z",
      lastUpdatedDate: "2023-02-10T01:29:09.595Z",
      mainImage: {
        link: "https://m.media-amazon.com/images/I/41cVJ8Gz6TL.jpg",
        height: 392,
        width: 444,
      },
    },
  ],
  attributes: {
    color: [
      {
        language_tag: "en_US",
        value: "Two-Tone",
        marketplace_id: "ATVPDKIKX0DER",
      },
    ],
  },
};

export const MOCK_GET_LISTINGS_ITEM_API_EMPTY_SUMMARY_RESPONSE = {
  sku: "S014-A03",
  summaries: [],
  attributes: {},
};

export const MOCK_PUT_AND_PATCH_LISTINGS_ITEM_API_SUCCESS_RESPONSE = {
  sku: "My SKU",
  status: "ACCEPTED",
  submissionId: "Some UUID",
};
