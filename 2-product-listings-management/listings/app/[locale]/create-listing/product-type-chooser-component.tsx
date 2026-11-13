import { ProductType } from "@/app/sdk/definitionsProductTypes_2020-09-01";
import React from "react";
import { Box } from "@mui/material";
import FormDropDownComponent from "@/app/components/form-drop-down-component";
import { useTranslations } from "use-intl";
import { CREATE_LISTING_USE_CASE } from "@/app/constants/global";
import AlertComponent from "@/app/components/alert";
import { useStateForDropDown } from "@/app/hooks/useStateForDropDown";

/**
 * @param productTypeResults: Product Type results from ProductType Search Form Component.
 * @param handleChosenProductType: call back function to submit the selected product type.
 */
interface InputProps {
  productTypeResults: ProductType[];
  handleChosenProductType: (result: string) => void;
}

/**
 * Component which displays an individual product type search result.
 * @param inputProps Input parameters to the component.
 */
export default function ProductTypeChooserComponent(inputProps: InputProps) {
  const translations = useTranslations(CREATE_LISTING_USE_CASE);
  const productTypeOptions: { key: string; label: string }[] =
    inputProps.productTypeResults.map((value) => {
      return { key: value.name, label: value.name };
    });
  const productTypeNames = productTypeOptions.map((value) => value.key);
  const [productType, handleProductTypeChange, setProductType] =
    useStateForDropDown(productTypeOptions[0]?.key, (selectedKey) =>
      inputProps.handleChosenProductType(selectedKey),
    );

  // Pass the first element by default as the chosen product type.
  if (productTypeNames.length === 1) {
    inputProps.handleChosenProductType(productTypeOptions[0].key);
  }

  /**
   * Retrieve the selected Item from the dropdown.
   *
   * When user chooses a different Product Type category, we need to reset the selected Product Type,
   * while retaining the current selected Product Type for the same Product Type Category.
   */
  const getSelectedItem = () => {
    // When user changes the PTs, we reset the drop-down options to pick the first one as default.
    if (!productTypeNames.includes(productType)) {
      const newChosenProductType = inputProps.productTypeResults[0].name;
      setProductType(newChosenProductType);
      inputProps.handleChosenProductType(newChosenProductType);
    }

    return productType;
  };

  const getTranslatedText = (key: string) =>
    translations(`ProductTypeChooser.${key}`);

  return (
    <>
      {inputProps.productTypeResults.length > 0 ? (
        <form
          id={"productTypeChooserComponent"}
          data-testid={"productTypeChooser"}
          style={{ marginTop: "5%" }}
        >
          <FormDropDownComponent
            id={getTranslatedText("productTypeId")}
            label={getTranslatedText("defaultLabel")}
            helpText={getTranslatedText("dropDownHelpText")}
            options={productTypeOptions}
            selectedKey={getSelectedItem()}
            onChange={handleProductTypeChange}
            disabled={productTypeNames.length === 1}
          />
        </form>
      ) : (
        <Box marginTop={5}>
          <AlertComponent
            id={"no-product-types-alert"}
            state={true}
            stateHandler={() => {}}
            severity={"info"}
            message={getTranslatedText("noProductTypeSearchResults")}
            staticAlert={true}
          />
        </Box>
      )}
    </>
  );
}
