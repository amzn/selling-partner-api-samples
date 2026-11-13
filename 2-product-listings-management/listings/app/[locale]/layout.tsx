import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import QuickLinksComponent from "@/app/components/quick-links";
import { getSettings } from "@/app/api/settings/wrapper";
import { Settings } from "@/app/[locale]/settings/settings";
import SettingsProvider from "@/app/context/settings-context-provider";
import NavigationComponent from "@/app/[locale]/navigation-component";
import { EMPTY_SETTINGS } from "@/app/api/settings/wrapper";
import React from "react";
import DebugComponent from "@/app/[locale]/debug-component";
import DebuggingContextProvider from "@/app/context/debug-context-provider";
import { US_EAST_1 } from "@/app/constants/global";
import AlertProvider from "@/app/context/alert-context-provider";

/**
 * This is the global app level lay out which is applied to all the pages of
 * app. The content of this file changes drastically.
 * @param children content of the pages which are wrapped with the global app
 * level layout.
 * @param params is a map which contains the user locale by the next-intl.
 */
export default async function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // load the translations for the user locale.
  let translations;
  try {
    translations = (
      await import(`../internationalization/translations/${locale}.json`)
    ).default;
  } catch (error) {
    // If there is any error, the server sends 404 status.
    notFound();
  }

  // Retrieve the Settings for the SettingsProvider.
  const settingsResponse = await getSettings();
  let settingsExist = false;
  let settings: Settings = {
    ...EMPTY_SETTINGS,
    region: US_EAST_1,
    sellingPartnerIdType: "Merchant Account Id",
  };
  if (settingsResponse.status === 200) {
    settings = settingsResponse.settings;
    settingsExist = true;
  }

  return (
    <html lang={locale}>
      <body>
        {/* Using the NextIntlClientProvider pass the locale and translations
         as content to all the child components.*/}
        <NextIntlClientProvider locale={locale} messages={translations}>
          <DebuggingContextProvider>
            <SettingsProvider
              initialSettingsExist={settingsExist}
              initialSettings={settings}
            >
              <AlertProvider>
                <NavigationComponent />
                <QuickLinksComponent />
                {children}
                <DebugComponent />
              </AlertProvider>
            </SettingsProvider>
          </DebuggingContextProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
