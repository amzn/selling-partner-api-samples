"use client";
import React, { useContext } from "react";
import { useTranslations } from "use-intl";
import { SWRConfig } from "swr";
import {
  LIIC_NOTIFICATION_TYPE,
  SELLER_NOTIFICATION_TYPES,
  SUBSCRIPTIONS_API_PATH,
  SWR_CONFIG_DEFAULT_VALUE,
  VENDOR_NOTIFICATION_TYPES,
} from "@/app/constants/global";
import { Container, Grid } from "@mui/material";
import TitleComponent from "@/app/components/title";
import SaveActionButton from "@/app/components/save-action-button";
import { v4 as uuid } from "uuid";
import { SettingsContext } from "@/app/context/settings-context-provider";
import {
  SELLING_PARTNER_TYPE_KEY_VENDOR_CODE,
  Settings,
} from "@/app/[locale]/settings/settings";
import FormDropDownComponent from "@/app/components/form-drop-down-component";
import AlertDialog from "@/app/components/alert-dialog";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import { useStateForDropDown } from "@/app/hooks/useStateForDropDown";

/**
 * A component which create subscription for notification.
 * @constructor
 */
export default function CreateSubscription() {
  const translations = useTranslations("CreateSubscription");
  const settingsContext = useContext(SettingsContext);
  const [selectedNotificationType, handleNotificationTypeChange] =
    useStateForDropDown(LIIC_NOTIFICATION_TYPE);

  const notificationSelectionOptionsForVendor = VENDOR_NOTIFICATION_TYPES.map(
    (notificationType) => {
      return {
        key: notificationType,
        label: notificationType,
      };
    },
  );
  const notificationSelectionOptionsForMerchant = SELLER_NOTIFICATION_TYPES.map(
    (notificationType) => {
      return {
        key: notificationType,
        label: notificationType,
      };
    },
  );

  const fetcherForActionButton = useCustomFetcher((fetcherKeys: string[]) => {
    const [url, notificationType] = fetcherKeys;
    return {
      method: "POST",
      headers: {
        notificationType: notificationType,
      },
    };
  });

  const getSupportedNotificationList = (settings: Settings) => {
    if (settings.sellingPartnerIdType == SELLING_PARTNER_TYPE_KEY_VENDOR_CODE) {
      return notificationSelectionOptionsForVendor;
    }
    return notificationSelectionOptionsForMerchant;
  };

  const showSubscriptionCreationResult = (data: any, onClose: () => void) => {
    if (!data.hasOwnProperty("subscriptionId")) {
      return (
        <AlertDialog
          title={translations("failureAlertTitle")}
          content={translations("conflictResourceAlertContent", data)}
          key={uuid()}
          onClose={onClose}
        />
      );
    }
    return (
      <AlertDialog
        title={translations("successAlertTitle")}
        content={translations("successAlertContent", data)}
        key={uuid()}
        onClose={onClose}
      />
    );
  };

  return (
    <SWRConfig value={SWR_CONFIG_DEFAULT_VALUE}>
      <Container maxWidth="md">
        <TitleComponent title={translations("pageTitle")} />
        <form data-testid="createSubscriptionRequestSubmit">
          <Grid container spacing={3}>
            <Grid container item>
              <FormDropDownComponent
                id={"notificationTypeDropDown"}
                label={translations("chooseSubscriptionLabel")}
                helpText={translations("chooseSubscriptionHelperText")}
                options={getSupportedNotificationList(
                  settingsContext.settingsState.settings,
                )}
                selectedKey={selectedNotificationType}
                onChange={handleNotificationTypeChange}
                xsDropDownWidth={9}
              />
            </Grid>

            <Grid container item>
              <SaveActionButton
                buttonName={translations("submitButtonName")}
                buttonHelpText={translations("submitButtonHelpText")}
                buttonId={"submitCreateSubscription"}
                fetchKeys={[SUBSCRIPTIONS_API_PATH, selectedNotificationType]}
                fetcher={fetcherForActionButton}
                failureAlertTitle={translations("failureAlertTitle")}
                failureAlertContent={translations("failureAlertContent")}
                fetchedDataHandler={showSubscriptionCreationResult}
                isButtonDisabled={false}
              />
            </Grid>
          </Grid>
        </form>
      </Container>
    </SWRConfig>
  );
}
