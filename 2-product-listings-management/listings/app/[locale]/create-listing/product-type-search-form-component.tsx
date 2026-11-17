import { ProductType } from "@/app/sdk/definitionsProductTypes_2020-09-01";
import { useTranslations } from "use-intl";
import React from "react";
import { Alert, Grid } from "@mui/material";
import SaveActionButton from "@/app/components/save-action-button";
import {
  CREATE_LISTING_USE_CASE,
  PRODUCT_TYPE_DEFINITIONS_API_PATH,
} from "@/app/constants/global";
import { useLocale } from "next-intl";
import { convertLocaleToSPAPIFormat } from "@/app/utils/i18n";
import FormInputComponent from "@/app/components/form-input-component";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import { useStateForTextField } from "@/app/hooks/useStateForTextField";

/**
 * Product Type Search Form Component to search different Product Types based on keywords.
 * @param handleSearchRequest Parent page will pass this function so that we can set product Type search result after
 * API call.
 * @constructor
 */
export default function ProductTypeSearchFormComponent({
  handleSearchRequest,
}: {
  handleSearchRequest: (results: ProductType[]) => void;
}) {
  const [keywords, handleKeywordsChange] = useStateForTextField("");
  const [itemName, handleItemNameChange] = useStateForTextField("");

  // Retrieve the translations for the CreateListing Page.
  const translations = useTranslations(CREATE_LISTING_USE_CASE);
  const locale = useLocale();

  // Error message if we fill out both keywords and itemName.
  const showOnlyOneLimitErrorMessage = Boolean(keywords) && Boolean(itemName);

  // Check whether we have valid input before submit.
  const isSubmitDisabled = showOnlyOneLimitErrorMessage;

  const translationNamespace = "CreateListing";

  const fetcherForActionButton = useCustomFetcher(
    (fetcherKeys: string[]) => {
      const [url, keywords, itemName, locale] = fetcherKeys;
      return {
        headers: {
          keywords: keywords,
          itemName: itemName,
          locale: locale,
        },
      };
    },
    (fetcherKeys: string[]) => (data) => {
      handleSearchRequest(data as ProductType[]);
      return data;
    },
  );

  const invokeOnClose = (data: any, onClose: () => void) => {
    onClose();
    return <></>;
  };

  return (
    <form data-testid="productTypeSearchRequestSubmit">
      <FormInputComponent
        id="keywordsInput"
        value={keywords}
        required={true}
        label={translations("keywords")}
        helpText={translations("keywordsLabelHelpText")}
        onChange={handleKeywordsChange}
      />
      <FormInputComponent
        id="itemNameInput"
        value={itemName}
        required={true}
        label={translations("itemName")}
        helpText={translations("itemNameLabelHelpText")}
        onChange={handleItemNameChange}
      />
      <SaveActionButton
        buttonName={translations("submit")}
        buttonHelpText={translations("submitHelpText")}
        buttonId={"submitButton"}
        fetchKeys={[
          PRODUCT_TYPE_DEFINITIONS_API_PATH,
          keywords,
          itemName,
          convertLocaleToSPAPIFormat(locale),
        ]}
        fetcher={fetcherForActionButton}
        failureAlertTitle={translations("failureAlertTitle")}
        failureAlertContent={translations("failureAlertContent")}
        fetchedDataHandler={invokeOnClose}
        isButtonDisabled={isSubmitDisabled}
      />
      <ProductTypeSearchInvalidInputAlert
        keywords={keywords}
        itemName={itemName}
        translationNamespace={translationNamespace}
      />
    </form>
  );
}

function ProductTypeSearchInvalidInputAlert({
  keywords,
  itemName,
  translationNamespace,
}: {
  keywords: string;
  itemName: string;
  translationNamespace: string;
}) {
  const translations = useTranslations(translationNamespace);

  // Error message if we fill out both keywords and itemName
  if (Boolean(keywords) && Boolean(itemName)) {
    return (
      <Grid item xs={8} sm={8}>
        {
          <Alert severity="error">
            {translations("productTypeSearchInvalidInput")}
          </Alert>
        }
      </Grid>
    );
  }
}
