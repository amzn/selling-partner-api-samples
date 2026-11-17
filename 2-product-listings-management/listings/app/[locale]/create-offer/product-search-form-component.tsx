import React from "react";
import { useTranslations } from "use-intl";
import {
  Alert,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@mui/material";
import { ProductSearchResult } from "@/app/[locale]/create-offer/product-result-type";
import {
  CATALOG_ITEMS_API_PATH,
  CREATE_OFFER_USE_CASE,
} from "@/app/constants/global";
import { useLocale } from "next-intl";
import SaveActionButton from "@/app/components/save-action-button";
import { convertLocaleToSPAPIFormat } from "@/app/utils/i18n";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import { useStateForTextField } from "@/app/hooks/useStateForTextField";
import { useStateForDropDown } from "@/app/hooks/useStateForDropDown";

/**
 * Product Search Form Component to search products based on identifiers or keywords.
 * @param handleSearchRequest Parent pass this function so that we can set product search result after API call.
 * @constructor
 */
export default function ProductSearchFormComponent({
  handleSearchRequest,
}: {
  handleSearchRequest: (results: ProductSearchResult[]) => void;
}) {
  const [identifiers, handleIdentifiersChange] = useStateForTextField("");
  const [keywords, handleKeywordsChange] = useStateForTextField("");
  const [identifiersType, handleIdentifierTypeChange] =
    useStateForDropDown("UPC");
  // Retrieve the translations for the CreateOffer Page.
  const translations = useTranslations(CREATE_OFFER_USE_CASE);
  const locale = useLocale();
  // Error message if we fill out both identifiers and keywords.
  const showOnlyOneLimitErrorMessage =
    Boolean(identifiers) && Boolean(keywords);

  // All the identifiers type we can choose.
  const identifiersTypeList = [
    "ASIN",
    "EAN",
    "GTIN",
    "ISBN",
    "JAN",
    "MINSAN",
    "SKU",
    "UPC",
  ];
  const identifierTypesId = "identifiersType";
  // Check whether we have valid input before submit.
  const isSubmitDisabled =
    showOnlyOneLimitErrorMessage || (!identifiers && !keywords);

  const invokeOnClose = (data: any, onClose: () => void) => {
    onClose();
    return <></>;
  };

  const fetcherForActionButton = useCustomFetcher(
    (fetcherKeys: string[]) => {
      const [url, identifiers, keywords, identifiersType, locale] = fetcherKeys;
      return {
        headers: {
          identifiers: identifiers,
          keywords: keywords,
          identifiersType: identifiersType,
          locale: locale,
        },
      };
    },
    (fetcherKeys) => (data) => {
      handleSearchRequest(data as ProductSearchResult[]);
      return data;
    },
  );

  return (
    <form data-testid="productSearchRequestSubmit">
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} sm={2}>
          <Tooltip title={translations("identifierLabelHelpText")}>
            <InputLabel htmlFor="identifiersInput">
              {translations("identifiers")}
            </InputLabel>
          </Tooltip>
        </Grid>
        <Grid item xs={6} sm={4}>
          <TextField
            id="identifiersInput"
            value={identifiers}
            onChange={handleIdentifiersChange}
            variant="outlined"
            margin="normal"
            size="small"
          />
        </Grid>
        <Grid item xs={6} sm={6}>
          <Select
            id={identifierTypesId}
            value={identifiersType}
            onChange={handleIdentifierTypeChange}
            variant="standard"
            size="small"
          >
            {identifiersTypeList.map((optionValue, index) => (
              <MenuItem id={identifierTypesId} key={index} value={optionValue}>
                {optionValue}
              </MenuItem>
            ))}
          </Select>
        </Grid>
        <Grid item xs={12} sm={2}>
          <Tooltip title={translations("keywordsLabelHelpText")}>
            <InputLabel htmlFor="keywordsInput">
              {translations("keywords")}
            </InputLabel>
          </Tooltip>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            id="keywordsInput"
            value={keywords}
            onChange={handleKeywordsChange}
            variant="outlined"
            margin="normal"
            size="small"
          />
        </Grid>
        <Grid item xs={8} sm={8}>
          {showOnlyOneLimitErrorMessage && (
            <Alert severity="error">
              {translations("productSearchInvalidInput")}
            </Alert>
          )}
        </Grid>
      </Grid>
      <Grid item style={{ marginTop: "1rem" }} xs={12} sm={12}>
        <SaveActionButton
          buttonName={translations("submit")}
          buttonHelpText={translations("submitHelpText")}
          buttonId={"submitButton"}
          fetchKeys={[
            CATALOG_ITEMS_API_PATH,
            identifiers,
            keywords,
            identifiersType,
            convertLocaleToSPAPIFormat(locale),
          ]}
          fetcher={fetcherForActionButton}
          failureAlertTitle={translations("failureAlertTitle")}
          failureAlertContent={translations("failureAlertContent")}
          fetchedDataHandler={invokeOnClose}
          isButtonDisabled={isSubmitDisabled}
        />
      </Grid>
    </form>
  );
}
