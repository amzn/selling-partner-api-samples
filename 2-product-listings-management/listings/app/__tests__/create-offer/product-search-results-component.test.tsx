import ProductSearchResultsComponent from "@/app/[locale]/create-offer/product-search-results-component";
import React from "react";
import translations from "@/app/internationalization/translations/en-US.json";
import { IntlProvider } from "next-intl";
import { render } from "@testing-library/react";
import { US_LOCALE } from "@/app/constants/global";

test("Snapshot Test for product search results component", () => {
  const results = [
    { title: "test1", asin: "asin1", productType: "productType1" },
    { title: "test2", asin: "asin2", productType: "productType2" },
  ];

  // Define a mock handleChosenClick function
  const handleChosenClick = jest.fn();

  const { asFragment } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <ProductSearchResultsComponent
        productSearchResults={results}
        handleChosenClick={handleChosenClick}
      />
      ,
    </IntlProvider>,
  );
  expect(asFragment()).toMatchSnapshot();
});

test("Snapshot Test for product search results component with empty results", () => {
  // Define a mock handleChosenClick function
  const handleChosenClick = jest.fn();

  const { asFragment } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <ProductSearchResultsComponent
        productSearchResults={[]}
        handleChosenClick={handleChosenClick}
      />
      ,
    </IntlProvider>,
  );
  expect(asFragment()).toMatchSnapshot();
});
