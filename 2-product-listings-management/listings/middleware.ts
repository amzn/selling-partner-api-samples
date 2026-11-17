import createMiddleware from "next-intl/middleware";
import { US_LOCALE } from "@/app/constants/global";

/**
 * Creates the middleware which derives the user locale for a request.
 */
export default createMiddleware({
  // A list of all locales that are supported
  locales: [US_LOCALE],
  // If none of locales match, then this locale is used.
  defaultLocale: US_LOCALE,
  localePrefix: "as-needed",
});

/**
 * Defines the config which applies the middleware to the requests which match
 * the criteria given in matcher.
 */
export const config = {
  // Skip all paths that should not be internationalized. This example skips the
  // folders "api", "_next" and all files with an extension (e.g. favicon.ico)
  matcher: ["/((?!api|sdk|_next|.*\\..*).*)"],
};
