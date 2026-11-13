import FormInputComponent from "@/app/components/form-input-component";
import AsyncFormDropDownComponent, {
  Options,
} from "@/app/components/form-async-drop-down-component";
import { Button, Paper } from "@mui/material";
import React, { useState } from "react";
import { ProductSearchResult } from "@/app/[locale]/create-offer/product-result-type";
import { useTranslations } from "use-intl";
import {
  CONDITION_TYPES_API_PATH,
  CREATE_OFFER_USE_CASE,
} from "@/app/constants/global";
import { useLocale } from "next-intl";
import { convertLocaleToSPAPIFormat } from "@/app/utils/i18n";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import { useStateForAsyncDropDown } from "@/app/hooks/useStateForAsyncDropDown";
import TooltipWrapper from "@/app/components/tooltip-wrapper";

/**
 * @param result: Individual Product Search result
 * @param listProduct: call back function to submit the selected product
 */
interface InputProps {
  result: ProductSearchResult;
  listProduct: (
    e: React.MouseEvent<HTMLButtonElement>,
    result: ProductSearchResult,
  ) => void;
}

/**
 * Component which displays an individual product search result.
 * @param props
 */
export default function ProductSearchResultComponent(props: InputProps) {
  const translations = useTranslations(CREATE_OFFER_USE_CASE);
  const locale = useLocale();

  const retrieveAllowedConditions = useCustomFetcher(
    (fetcherKeys: string[]) => {
      const [url, asin] = fetcherKeys;
      return {
        headers: {
          asin: asin,
          locale: convertLocaleToSPAPIFormat(locale),
        },
      };
    },
    (fetcherKeys) => (data) => {
      const allowedTypes: string[] = data;
      const options: Options[] = allowedTypes.map((conditionType) => {
        return { key: conditionType, value: conditionType };
      });
      setDisableButton(options.length === 0);
      return options;
    },
  );

  const getTranslatedText = (key: string) =>
    translations(`ProductSearchResult.${key}`);

  const [conditionType, handleConditionTypeChange] =
    useStateForAsyncDropDown("");
  const [disableButton, setDisableButton] = useState(true);

  const handleListProductButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => props.listProduct(event, props.result);

  return (
    <Paper style={{ padding: 10, margin: 15 }} elevation={3}>
      <FormInputComponent
        id={props.result.title}
        required={true}
        label={getTranslatedText("title")}
        value={props.result.title}
        helpText={getTranslatedText("titleHelpText")}
        disabled={true}
      />
      <FormInputComponent
        id={props.result.asin}
        required={true}
        label={getTranslatedText("asin")}
        value={props.result.asin}
        helpText={getTranslatedText("asinHelpText")}
        disabled={true}
      />
      <FormInputComponent
        id={props.result.asin + "-" + props.result.productType}
        required={true}
        label={getTranslatedText("productType")}
        value={props.result.productType}
        helpText={getTranslatedText("productTypeHelpText")}
        disabled={true}
      />
      <AsyncFormDropDownComponent
        id={props.result.asin + "-condition-type"}
        required={true}
        label={getTranslatedText("allowedConditions")}
        helpText={getTranslatedText("allowedConditionsHelpText")}
        inputFieldLabel={getTranslatedText("allowedConditionsFieldLabel")}
        onChange={handleConditionTypeChange}
        query={[CONDITION_TYPES_API_PATH, props.result.asin]}
        fetcher={retrieveAllowedConditions}
        noOptionsText={getTranslatedText("noAvailableOptionsText")}
      />
      <TooltipWrapper title={getTranslatedText("listProductButtonHelpText")}>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={handleListProductButtonClick}
          disabled={disableButton}
        >
          {getTranslatedText("listProductButton")}
        </Button>
      </TooltipWrapper>
    </Paper>
  );
}
