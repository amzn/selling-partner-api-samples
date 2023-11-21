"use client";
import {
  areSettingsIncomplete,
  Settings,
} from "@/app/[locale]/settings/settings";
import React, { createContext, useState } from "react";
import { EMPTY_SETTINGS } from "@/app/test-utils/mock-settings";
import AlertComponent from "@/app/components/alert";
import Container from "@mui/material/Container";
import { useTranslations } from "use-intl";

/**
 * The Settings state.
 */
export interface SettingsState {
  settingsExist: boolean;
  settings: Settings;
}

/**
 * The state which is provided by the settings provider.
 */
export interface SettableSettingsState {
  settingsState: SettingsState;
  setSettingsState: (settingsState: SettingsState) => void;
}

/**
 * The React context for the settings.
 */
export const SettingsContext = createContext<SettableSettingsState>({
  settingsState: {
    settings: EMPTY_SETTINGS,
    settingsExist: false,
  },
  setSettingsState: (settingsState: SettingsState) => {},
});

/**
 * Wraps the child elements with the React Content Provider for the Settings.
 * @param children the child elements.
 * @param initialSettingsExist indicates whether the settings exist.
 * @param initialSettings the initial state of the settings.
 * @constructor
 */
export default function SettingsProvider({
  children,
  initialSettingsExist,
  initialSettings,
}: {
  children: React.ReactNode;
  initialSettingsExist: boolean;
  initialSettings: Settings;
}) {
  const translations = useTranslations("SettingsProvider");
  const [settingsState, setSettingsState] = useState<SettingsState>({
    settings: initialSettings,
    settingsExist: initialSettingsExist,
  });

  const showSettingsMissingAlert =
    !settingsState.settingsExist ||
    areSettingsIncomplete(settingsState.settings);

  return (
    <SettingsContext.Provider value={{ settingsState, setSettingsState }}>
      <Container maxWidth="md">
        {showSettingsMissingAlert && (
          <AlertComponent
            id={"noSettings"}
            state={true}
            stateHandler={() => {}}
            severity={"error"}
            message={translations("settingsMissingMessage")}
            staticAlert={true}
          />
        )}
      </Container>
      {children}
    </SettingsContext.Provider>
  );
}
