import { getRequestConfig } from "next-intl/server";

/**
 * This method provides the translations to all the server components for a user
 * locale. This method gets invoked for every request.
 */
export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./translations/${locale}.json`)).default,
}));
