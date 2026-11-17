import React from "react";
import { Container, Paper } from "@mui/material";
import { ProductSearchResult } from "@/app/[locale]/create-offer/product-result-type";
import ProductSearchResultComponent from "@/app/[locale]/create-offer/product-search-result-component";
import TitleComponent from "@/app/components/title";
import { useTranslations } from "use-intl";
import { CREATE_OFFER_USE_CASE } from "@/app/constants/global";
import AlertComponent from "@/app/components/alert";

/**
 * @param productSearchResults: List of product search results to show.
 * @param handleChosenClick: Handler function passed by the parent to deal with the selected product.
 */
interface InputProps {
  productSearchResults: ProductSearchResult[];
  handleChosenClick: (result: ProductSearchResult) => void;
}

/**
 * Product Search Result Component to show the product search results.
 * @param props Input props
 */
export default function ProductSearchResultsComponent(props: InputProps) {
  const translations = useTranslations(CREATE_OFFER_USE_CASE);

  const chooseResult = (
    e: React.MouseEvent<HTMLButtonElement>,
    result: ProductSearchResult,
  ) => {
    e.preventDefault();
    props.handleChosenClick(result);
  };

  return (
    <Container>
      <TitleComponent title={translations("productSearchResultsTitle")} />
      {props.productSearchResults?.length > 0 ? (
        <Paper style={{ marginTop: 10, maxHeight: 500, overflow: "auto" }}>
          {props.productSearchResults.map((result, index) => (
            <ProductSearchResultComponent
              result={result}
              listProduct={chooseResult}
              key={result.asin}
            />
          ))}
        </Paper>
      ) : (
        <AlertComponent
          id={"no-products-alert"}
          state={true}
          stateHandler={() => {}}
          severity={"info"}
          message={translations("noProductSearchResults")}
          staticAlert={true}
        />
      )}
    </Container>
  );
}
