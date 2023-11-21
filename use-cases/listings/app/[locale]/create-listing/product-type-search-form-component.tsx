import { ProductType } from "@/app/sdk/definitionsProductTypes_2020-09-01";
import { useTranslations } from "use-intl";
import React from "react";
import SaveActionButton from "@/app/components/save-action-button";
import {
  CREATE_LISTING_USE_CASE,
  PRODUCT_TYPE_DEFINITIONS_API_PATH,
} from "@/app/constants/global";
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
  const translations = useTranslations(CREATE_LISTING_USE_CASE);

  const fetcherForActionButton = useCustomFetcher(
    (fetcherKeys: string[]) => {
      const [url, keywords] = fetcherKeys;
      return {
        headers: {
          keywords: keywords,
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
      <SaveActionButton
        buttonName={translations("submit")}
        buttonHelpText={translations("submitHelpText")}
        buttonId={"submitButton"}
        fetchKeys={[PRODUCT_TYPE_DEFINITIONS_API_PATH, keywords]}
        fetcher={fetcherForActionButton}
        failureAlertTitle={translations("failureAlertTitle")}
        failureAlertContent={translations("failureAlertContent")}
        fetchedDataHandler={invokeOnClose}
        isButtonDisabled={false}
      />
    </form>
  );
}
