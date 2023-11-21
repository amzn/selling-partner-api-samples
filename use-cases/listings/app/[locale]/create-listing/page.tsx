"use client";
import React, { useState } from "react";
import { ProductType } from "@/app/sdk/definitionsProductTypes_2020-09-01";
import { SWRConfig } from "swr";
import { Container } from "@mui/material";
import { useTranslations } from "use-intl";
import ProductTypeSearchFormComponent from "@/app/[locale]/create-listing/product-type-search-form-component";
import {
  CREATE_LISTING_USE_CASE,
  SWR_CONFIG_DEFAULT_VALUE,
} from "@/app/constants/global";
import ProductTypeChooserComponent from "@/app/[locale]/create-listing/product-type-chooser-component";
import ListingCreationFormComponent from "@/app/components/listing/listing-creation-form-component";
import { DividerComponent } from "@/app/components/divider-component";
import TitleComponent from "@/app/components/title";

/**
 * The main page of create listing tab.
 * @constructor
 */
export default function CreateListing() {
  const [productTypeResults, setProductTypeResults] = useState<ProductType[]>();
  const translations = useTranslations(CREATE_LISTING_USE_CASE);
  const [chosenProductType, setChosenProductType] = useState("");

  // Pass search result to ProductTypeSearchResultComponent
  const handleSearchRequestSubmit = (results: ProductType[]) =>
    setProductTypeResults(results);

  const handleChosenProductType = (result: string) =>
    setChosenProductType(result);

  return (
    <SWRConfig value={SWR_CONFIG_DEFAULT_VALUE}>
      <Container maxWidth="md">
        <TitleComponent title={translations("pageTitle")} />
        <ProductTypeSearchFormComponent
          handleSearchRequest={handleSearchRequestSubmit}
        />
        {productTypeResults && (
          <ProductTypeChooserComponent
            productTypeResults={productTypeResults}
            handleChosenProductType={handleChosenProductType}
          />
        )}
        {productTypeResults &&
          productTypeResults.length > 0 &&
          chosenProductType && (
            <>
              <DividerComponent />
              <ListingCreationFormComponent
                chosenProductType={chosenProductType}
                useCase={CREATE_LISTING_USE_CASE}
              />
            </>
          )}
      </Container>
    </SWRConfig>
  );
}
