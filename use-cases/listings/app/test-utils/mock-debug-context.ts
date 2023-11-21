import { SPAPIRequestResponse } from "@/app/model/types";

export const MOCK_SP_API_RESPONSE: SPAPIRequestResponse = {
  apiName: "GetListingsItem",
  apiDocumentationLink: "https://amazon.com",
  request: {
    marketplaceId: "ATVPDKIKX0DER",
    locale: "en_US",
    asin: "A1F83G8C2ARO7P",
  },
  response: {
    item: "Dummy Item",
  },
};
