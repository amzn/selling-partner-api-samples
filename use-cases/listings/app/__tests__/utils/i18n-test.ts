import { convertLocaleToSPAPIFormat } from "@/app/utils/i18n";
import { US_LOCALE } from "@/app/constants/global";

describe("Tests for the i18n util", () => {
  test("Test the convertLocaleToSPAPIFormat", () => {
    expect(convertLocaleToSPAPIFormat(US_LOCALE)).toStrictEqual("en_US");
  });
});
