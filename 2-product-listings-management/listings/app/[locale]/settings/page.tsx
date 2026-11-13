"use client";

import { Button, Container, Grid, SelectChangeEvent } from "@mui/material";
import FormInputComponent from "@/app/components/form-input-component";
import FormDropDownComponent from "@/app/components/form-drop-down-component";
import React, { useContext, useState } from "react";
import { useTranslations } from "use-intl";
import { areSettingsIncomplete } from "@/app/[locale]/settings/settings";
import TitleComponent from "@/app/components/title";
import NextLink from "next/link";
import { SettingsContext } from "@/app/context/settings-context-provider";
import {
  ACCOUNT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  MARKETPLACE_ID,
  REFRESH_TOKEN,
  REGION,
  SELLING_PARTNER_ID,
  SELLING_PARTNER_ID_TYPE,
  SELLING_PARTNER_TYPES,
  SETTINGS_API_PATH,
  SWR_CONFIG_DEFAULT_VALUE,
  VALID_AWS_REGIONS,
} from "@/app/constants/global";
import FormPasswordInputComponent from "@/app/components/form-password-input-component";
import SaveActionButton from "@/app/components/save-action-button";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import AlertDialog from "@/app/components/alert-dialog";
import { v4 as uuid } from "uuid";
import { SWRConfig } from "swr";

/**
 * Settings page.
 * @constructor
 */
export default function Settings() {
  const translations = useTranslations("Settings");
  const settingsContext = useContext(SettingsContext);

  const [settings, setSettings] = useState(
    settingsContext.settingsState.settings,
  );
  const handleSettingsPropsChange = (prop: string, newValue: string) =>
    setSettings({ ...settings, [prop]: newValue });
  const isSaveDisabled = areSettingsIncomplete(settings);

  const fetcherForSaveActionButton = useCustomFetcher(
    (fetcherKeys) => {
      const httpMethod = settingsContext.settingsState.settingsExist
        ? "PUT"
        : "POST";
      return {
        method: httpMethod,
        headers: {
          settings: JSON.stringify(settings),
        },
      };
    },
    (fetcherKeys) => (data) => {
      settingsContext.setSettingsState({
        settings: settings,
        settingsExist: true,
      });
      return data;
    },
  );

  const showSuccessfulAlert = (data: any, onClose: () => void) => (
    <AlertDialog
      key={uuid()}
      title={translations("successAlertTitle")}
      content={translations("successAlertContent")}
      onClose={onClose}
    />
  );

  return (
    <SWRConfig value={SWR_CONFIG_DEFAULT_VALUE}>
      <Container maxWidth="md" sx={{ paddingTop: "2%" }}>
        <TitleComponent title={translations("pageTitle")} />
        <form id={"settings"} data-testid={"submitSettings"}>
          <FormPasswordInputComponent
            id={ACCOUNT_ID}
            value={settings.accountId}
            required={true}
            label={translations(ACCOUNT_ID)}
            helpText={translations("accountIdHelpText")}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSettingsPropsChange(ACCOUNT_ID, e.target.value)
            }
          />
          <FormDropDownComponent
            id={REGION}
            label={translations(REGION)}
            helpText={translations("regionHelpText")}
            options={VALID_AWS_REGIONS}
            selectedKey={settings.region}
            onChange={(e: SelectChangeEvent) =>
              handleSettingsPropsChange(REGION, e.target.value)
            }
          />
          <FormPasswordInputComponent
            id={CLIENT_ID}
            value={settings.clientId}
            required={true}
            label={translations(CLIENT_ID)}
            helpText={translations("clientIdHelpText")}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSettingsPropsChange(CLIENT_ID, e.target.value)
            }
          />
          <FormPasswordInputComponent
            id={CLIENT_SECRET}
            value={settings.clientSecret}
            required={true}
            label={translations(CLIENT_SECRET)}
            helpText={translations("clientSecretHelpText")}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSettingsPropsChange(CLIENT_SECRET, e.target.value)
            }
          />
          <FormPasswordInputComponent
            id={REFRESH_TOKEN}
            value={settings.refreshToken}
            required={true}
            label={translations(REFRESH_TOKEN)}
            helpText={translations("refreshTokenHelpText")}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSettingsPropsChange(REFRESH_TOKEN, e.target.value)
            }
          />
          <FormInputComponent
            id={SELLING_PARTNER_ID}
            value={settings.sellingPartnerId}
            required={true}
            label={translations(SELLING_PARTNER_ID)}
            helpText={translations("sellingPartnerIdHelpText")}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSettingsPropsChange(SELLING_PARTNER_ID, e.target.value)
            }
          />
          <FormDropDownComponent
            id={SELLING_PARTNER_ID_TYPE}
            label={translations(SELLING_PARTNER_ID_TYPE)}
            helpText={translations("sellingPartnerIdTypeHelpText")}
            options={SELLING_PARTNER_TYPES}
            selectedKey={settings.sellingPartnerIdType}
            onChange={(e: SelectChangeEvent) =>
              handleSettingsPropsChange(SELLING_PARTNER_ID_TYPE, e.target.value)
            }
          />
          <FormInputComponent
            id={MARKETPLACE_ID}
            value={settings.marketplaceId}
            required={true}
            label={translations(MARKETPLACE_ID)}
            helpText={translations("marketplaceIdHelpText")}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSettingsPropsChange(MARKETPLACE_ID, e.target.value)
            }
          />
          <Grid container spacing={3} alignItems="center">
            <Grid item style={{ marginTop: "1rem" }}>
              <SaveActionButton
                buttonName={translations("submit")}
                buttonHelpText={translations("submitHelpText")}
                buttonId={"save"}
                fetchKeys={[SETTINGS_API_PATH]}
                fetcher={fetcherForSaveActionButton}
                failureAlertTitle={translations("failureAlertTitle")}
                failureAlertContent={translations("failureAlertContent")}
                fetchedDataHandler={showSuccessfulAlert}
                isButtonDisabled={isSaveDisabled}
              />
            </Grid>
            <Grid item style={{ marginTop: "1rem" }}>
              <NextLink href="/" passHref>
                <Button variant="contained">{translations("cancel")}</Button>
              </NextLink>
            </Grid>
          </Grid>
        </form>
      </Container>
    </SWRConfig>
  );
}
