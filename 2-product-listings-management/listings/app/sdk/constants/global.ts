const APP_NAME = "SellingPartnerAPIListingSampleApplication";
const APP_VERSION = "1.0";
const APP_LANGUAGE = "TypeScript";
const APP_LANGUAGE_VERSION = "5.0";
const OPT_OUT = false;
/**
 * Header data to be passed to all the SP-API.
 */
export const HEADER_DATA = OPT_OUT
  ? {}
  : {
      "User-Agent": `${APP_NAME}/${APP_VERSION} (Language=${APP_LANGUAGE}/${APP_LANGUAGE_VERSION})`,
    };
