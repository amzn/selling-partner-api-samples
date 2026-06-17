import { Low, Memory } from "lowdb";

export enum Api {
  LISTINGS = "listings",
  ORDERS = "orders",
  INVENTORY = "inventory",
  EXT_FULFILLMENT_INVENTORY = "extFulfillmentInventory",
  EXT_FULFILLMENT_RETURNS = "extFulfillmentReturns",
  EXT_FULFILLMENT_SHIPMENTS = "extFulfillmentShipments",
  CATALOG = "catalog",
  PRICING = "pricing",
  REPORTS = "reports",
}

type Data = Record<Api, Record<string, any>>;

export class Context {
  static #instance: Context;
  readonly db: Low<Data>;

  private constructor() {
    this.db = new Low(new Memory(), {
      [Api.LISTINGS]: {},
      [Api.ORDERS]: {},
      [Api.INVENTORY]: {},
      [Api.EXT_FULFILLMENT_INVENTORY]: {},
      [Api.EXT_FULFILLMENT_RETURNS]: {},
      [Api.EXT_FULFILLMENT_SHIPMENTS]: {},
      [Api.CATALOG]: {},
      [Api.PRICING]: {},
      [Api.REPORTS]: {},
    });
    this.addSeedData();
  }

  public async clear() {
    await this.db.read();
    for (const key of Object.keys(this.db.data) as (keyof typeof this.db.data)[]) {
      this.db.data[key] = {};
    }
    this.addSeedData();
    await this.db.write();
  }

  private addSeedData() {
    // Catalog seed data
    this.db.data.catalog.B0F4X2K9LM = {
      asin: "B0F4X2K9LM",
      summaries: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          brandName: "GameTech",
          itemName: "Next-Gen Gaming Console - Upcoming Release",
          manufacturer: "GameTech Electronics",
          itemClassification: "BASE_PRODUCT",
          productType: "VIDEO_GAME_CONSOLE",
        },
      ],
      identifiers: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          identifiers: [
            { identifierType: "UPC", identifier: "012345678901" },
            { identifierType: "EAN", identifier: "0012345678901" },
          ],
        },
      ],
      images: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          images: [{ variant: "MAIN", link: "https://m.media-amazon.com/images/I/example-console.jpg", height: 1000, width: 1000 }],
        },
      ],
      salesRanks: [{ marketplaceId: "ATVPDKIKX0DER", classificationRanks: [{ classificationId: "videogames", title: "Video Games", rank: 42 }] }],
      dimensions: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          item: {
            height: { value: 3.9, unit: "INCHES" },
            length: { value: 15.4, unit: "INCHES" },
            width: { value: 12.0, unit: "INCHES" },
            weight: { value: 9.8, unit: "POUNDS" },
          },
        },
      ],
      relationships: [{ marketplaceId: "ATVPDKIKX0DER", relationships: [] }],
    };
    this.db.data.catalog.B0A7M3N5QR = {
      asin: "B0A7M3N5QR",
      summaries: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          brandName: "BrewMaster",
          itemName: "Premium Coffee Maker with Timer",
          manufacturer: "BrewMaster Home",
          itemClassification: "BASE_PRODUCT",
          productType: "COFFEE_MAKER",
        },
      ],
      identifiers: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          identifiers: [
            { identifierType: "UPC", identifier: "023456789012" },
            { identifierType: "EAN", identifier: "0023456789012" },
          ],
        },
      ],
      images: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          images: [
            { variant: "MAIN", link: "https://m.media-amazon.com/images/I/example-coffee.jpg", height: 1200, width: 1200 },
            { variant: "PT01", link: "https://m.media-amazon.com/images/I/example-coffee-side.jpg", height: 1200, width: 1200 },
          ],
        },
      ],
      salesRanks: [{ marketplaceId: "ATVPDKIKX0DER", classificationRanks: [{ classificationId: "kitchen", title: "Kitchen & Dining", rank: 156 }] }],
      dimensions: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          item: {
            height: { value: 14.2, unit: "INCHES" },
            length: { value: 8.5, unit: "INCHES" },
            width: { value: 6.8, unit: "INCHES" },
            weight: { value: 5.2, unit: "POUNDS" },
          },
        },
      ],
      relationships: [{ marketplaceId: "ATVPDKIKX0DER", relationships: [] }],
    };
    this.db.data.catalog.B0B8K4L7ST = {
      asin: "B0B8K4L7ST",
      summaries: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          brandName: "HydroElite",
          itemName: "Stainless Steel Water Bottle Set",
          manufacturer: "HydroElite Outdoors",
          itemClassification: "VARIATION_PARENT",
          productType: "WATER_BOTTLE",
        },
      ],
      identifiers: [{ marketplaceId: "ATVPDKIKX0DER", identifiers: [{ identifierType: "UPC", identifier: "034567890123" }] }],
      images: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          images: [{ variant: "MAIN", link: "https://m.media-amazon.com/images/I/example-bottle.jpg", height: 1500, width: 1500 }],
        },
      ],
      salesRanks: [{ marketplaceId: "ATVPDKIKX0DER", classificationRanks: [{ classificationId: "sports", title: "Sports & Outdoors", rank: 89 }] }],
      dimensions: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          item: {
            height: { value: 10.5, unit: "INCHES" },
            length: { value: 3.2, unit: "INCHES" },
            width: { value: 3.2, unit: "INCHES" },
            weight: { value: 0.75, unit: "POUNDS" },
          },
        },
      ],
      relationships: [
        {
          marketplaceId: "ATVPDKIKX0DER",
          relationships: [{ childAsins: ["B0B8K4L7S1", "B0B8K4L7S2"], type: "VARIATION", variationTheme: { attributes: ["color", "size"] } }],
        },
      ],
    };
  }

  public static get instance(): Context {
    if (!Context.#instance) {
      Context.#instance = new Context();
    }

    return Context.#instance;
  }
}
