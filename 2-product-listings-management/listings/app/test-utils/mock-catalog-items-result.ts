export const MOCK_CATALOG_ITEMS_API_RESPONSE: object = {
  numberOfResults: 1,
  items: [
    {
      asin: "B00004SPEC",
      productTypes: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          productType: "KITCHEN",
        },
      ],
      summaries: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          adultProduct: false,
          autographed: false,
          brand: "KRUPS",
          browseClassification: {
            displayName: "Countertop Blenders",
            classificationId: "289915",
          },
          itemClassification: "BASE_PRODUCT",
          itemName: "Krups 243-70 Power X Plus Combi Blender, DISCONTINUED",
          manufacturer: "KRUPS",
          memorabilia: false,
          modelNumber: "243-70",
          packageQuantity: 1,
          partNumber: "243-70",
          style: "Modern",
          tradeInEligible: false,
          websiteDisplayGroup: "kitchen_display_on_website",
          websiteDisplayGroupName: "Kitchen",
        },
      ],
    },
  ],
};

export const MOCK_CATALOG_ITEMS_API_EMPTY_RESPONSE: object = {
  numberOfResults: 0,
};
