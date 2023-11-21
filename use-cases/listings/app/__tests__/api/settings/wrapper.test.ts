import { getSettings } from "@/app/api/settings/wrapper";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";

test("Test wrapper parses response on GET call", async () => {
  const settings = {
    settings: JSON.stringify(MOCK_SETTINGS),
  };

  mockResolveFetchResponse(200, settings);

  const response = await getSettings();
  expect(response.status).toStrictEqual(200);
  expect(response.statusText).toStrictEqual("OK");
  expect(response.settings).toStrictEqual(MOCK_SETTINGS);
});
