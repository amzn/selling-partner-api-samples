"use client";
import React, { useState } from "react";
import ProductSearchResultsComponent from "@/app/[locale]/create-offer/product-search-results-component";
import ProductSearchFormComponent from "@/app/[locale]/create-offer/product-search-form-component";
import { useTranslations } from "use-intl";
import { Container } from "@mui/material";
import { ProductSearchResult } from "@/app/[locale]/create-offer/product-result-type";
import { SWRConfig } from "swr";
import { DividerComponent } from "@/app/components/divider-component";
import {
  CREATE_OFFER_USE_CASE,
  SWR_CONFIG_DEFAULT_VALUE,
} from "@/app/constants/global";
import ListingCreationFormComponent from "@/app/components/listing/listing-creation-form-component";
import TitleComponent from "@/app/components/title";

/**
 * The main page of create offer tab.
 * @constructor
 */
export default function CreateOffer() {
  const [productSearchResults, setProductSearchResults] =
    useState<ProductSearchResult[]>();
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult>();
  const translations = useTranslations(CREATE_OFFER_USE_CASE);

  // Pass search result to ProductSearchResultComponent
  const handleSearchRequestSubmit = (results: ProductSearchResult[]) =>
    setProductSearchResults(results);

  // Set the selected product search result, and pass it to ListingOfferOnlyCreationFormComponent
  const handleChosenClick = (result: ProductSearchResult) =>
    setSelectedProduct(result);

  return (
    <SWRConfig value={SWR_CONFIG_DEFAULT_VALUE}>
      <Container maxWidth="md">
        <TitleComponent title={translations("pageTitle")} />
        <ProductSearchFormComponent
          handleSearchRequest={handleSearchRequestSubmit}
        />
        {productSearchResults && (
          <>
            <DividerComponent />
            <ProductSearchResultsComponent
              productSearchResults={productSearchResults}
              handleChosenClick={handleChosenClick}
            />
          </>
        )}
        {selectedProduct && (
          <>
            <DividerComponent />
            <ListingCreationFormComponent
              chosenProductType={selectedProduct.productType}
              useCase={CREATE_OFFER_USE_CASE}
            />
          </>
        )}
      </Container>
    </SWRConfig>
  );
}
