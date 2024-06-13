"use client";
import { SWRConfig } from "swr";
import {
  DELETE_LISTING_USE_CASE,
  LISTINGS_ITEM_API_PATH,
  SWR_CONFIG_DEFAULT_VALUE,
} from "@/app/constants/global";
import { Container } from "@mui/material";
import React from "react";
import { useTranslations } from "use-intl";
import FormInputComponent from "@/app/components/form-input-component";
import SaveActionButton from "@/app/components/save-action-button";
import { useLocale } from "next-intl";
import { convertLocaleToSPAPIFormat } from "@/app/utils/i18n";
import { v4 as uuid } from "uuid";
import ListingSubmissionResultDialog from "@/app/components/listing-submission-result-dialog";
import TitleComponent from "@/app/components/title";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import { useStateForTextField } from "@/app/hooks/useStateForTextField";

export default function Page() {
  const [sku, handleSkuChange] = useStateForTextField("");
  const locale = useLocale();

  const translations = useTranslations(DELETE_LISTING_USE_CASE);
  const fetcherForActionButton = useCustomFetcher((fetcherKeys: string[]) => {
    return {
      method: "DELETE",
      headers: {
        sku: sku,
        locale: convertLocaleToSPAPIFormat(locale),
      },
    };
  });

  const showListingSubmissionResults = (data: any, onClose: () => void) => (
    <ListingSubmissionResultDialog
      key={uuid()}
      result={data}
      onClose={onClose}
      dialogID="ListingSubmitButtonSubmissionResultDialog"
    />
  );

  return (
    <SWRConfig value={SWR_CONFIG_DEFAULT_VALUE}>
      <Container maxWidth="md">
        <TitleComponent title={translations("pageTitle")} />

        <form data-testid="deleteListingRequestSubmit">
          <FormInputComponent
            id="skuInput"
            value={sku}
            required={true}
            label={translations("sku")}
            helpText={translations("skuLabelHelpText")}
            onChange={handleSkuChange}
          />
          <SaveActionButton
            buttonName={translations("submit")}
            buttonHelpText={translations("submitHelpText")}
            buttonId="submitButton"
            fetchKeys={[LISTINGS_ITEM_API_PATH, sku, locale]}
            fetcher={fetcherForActionButton}
            failureAlertTitle={translations("failureAlertTitle")}
            failureAlertContent={translations("failureAlertContent")}
            fetchedDataHandler={showListingSubmissionResults}
            isButtonDisabled={!sku}
            confirmationOptions={{
              showConfirmation: true,
              confirmationTitle: translations("confirmationTitle"),
              confirmationContent: translations("confirmationContent"),
              confirmationButtonContent: translations(
                "confirmationButtonContent",
              ),
              confirmationCancelButtonContent: translations(
                "confirmationCancelButtonContent",
              ),
            }}
          />
        </form>
      </Container>
    </SWRConfig>
  );
}
