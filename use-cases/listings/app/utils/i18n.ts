/**
 * Helper function which converts the locales like en-US to en_US.
 * @param bcp47Locale
 */
export function convertLocaleToSPAPIFormat(bcp47Locale: string) {
  const intlLocale = new Intl.Locale(bcp47Locale);
  return `${intlLocale.language}_${intlLocale.region}`;
}
