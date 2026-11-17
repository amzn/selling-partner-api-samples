import { render, act, cleanup } from "@testing-library/react";
import CreateOffer from "@/app/[locale]/create-offer/page";
import { IntlProvider } from "next-intl";
import React from "react";
import { afterEach } from "@jest/globals";
import { ProductSearchResult } from "@/app/[locale]/create-offer/product-result-type";
import translations from "@/app/internationalization/translations/en-US.json";
import { US_LOCALE } from "@/app/constants/global";

/**
 * Mock the ProductSearchFormComponent module
 * The detail test of logic of ProductSearchFormComponent should be separate test
 */
jest.mock("@/app/[locale]/create-offer/product-search-form-component", () => ({
  __esModule: true,
  default: ({
    handleSearchRequest,
  }: {
    handleSearchRequest: (results: ProductSearchResult[]) => void;
  }) => {
    return (
      <div>
        <p>ProductSearchFormComponent</p>
        <button
          onClick={() =>
            handleSearchRequest([
              { title: "Test Product 1", asin: "ASIN1", productType: "Type1" },
              { title: "Test Product 2", asin: "ASIN2", productType: "Type2" },
            ])
          }
        >
          ProductSearchFormComponentSubmit
        </button>
      </div>
    );
  },
}));

/**
 * Mock the ProductSearchResultComponent module
 * The detail test of logic of ProductSearchResultComponent should be separate test
 */
jest.mock(
  "@/app/[locale]/create-offer/product-search-results-component",
  () => ({
    __esModule: true,
    default: ({
      productSearchResults,
      handleChosenClick,
    }: {
      productSearchResults: ProductSearchResult[];
      handleChosenClick: (result: ProductSearchResult) => void;
    }) => {
      return (
        <div>
          <p>ProductSearchResultComponent</p>
          <button
            onClick={() =>
              handleChosenClick({
                title: "Test Product 1",
                asin: "ASIN1",
                productType: "Type1",
              })
            }
          >
            ProductSearchResultComponentSubmit
          </button>
        </div>
      );
    },
  }),
);

function MockedListingCreationForm() {
  return (
    <div>
      <p>ListingCreationFormComponent</p>
    </div>
  );
}

/**
 * Mock the ListingCreationFormComponent module
 */
jest.mock(
  "@/app/components/listing/listing-creation-form-component",
  () => MockedListingCreationForm,
);

// Define your global afterEach function
afterEach(() => {
  // Cleanup any resources or state after each test
  cleanup();
});

test("Snapshot Test for the create offer home page", () => {
  const { asFragment, queryByText } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <CreateOffer />
    </IntlProvider>,
  );
  const productSearchFormComponent = queryByText("ProductSearchFormComponent");
  expect(productSearchFormComponent).toBeTruthy();

  const productSearchResultComponent = queryByText(
    "ProductSearchResultComponent",
  );
  expect(productSearchResultComponent).toBeNull();

  const listingCreationFormComponent = queryByText(
    "ListingCreationFormComponent",
  );
  expect(listingCreationFormComponent).toBeNull();

  expect(asFragment()).toMatchSnapshot();
});

test("Snapshot Test for the create offer home page with search result", () => {
  const { asFragment, queryByText, getByText } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <CreateOffer />
    </IntlProvider>,
  );

  // Use the act function to set the state
  act(() => {
    // Fire the handleSearchRequestSubmit with mockResults
    getByText("ProductSearchFormComponentSubmit").click();
  });

  const productSearchFormComponent = queryByText("ProductSearchFormComponent");
  expect(productSearchFormComponent).toBeTruthy();

  const productSearchResultComponent = queryByText(
    "ProductSearchResultComponent",
  );
  expect(productSearchResultComponent).toBeTruthy();

  const listingCreationFormComponent = queryByText(
    "ListingCreationFormComponent",
  );
  expect(listingCreationFormComponent).toBeNull();

  expect(asFragment()).toMatchSnapshot();
});

test("Snapshot Test for the create offer home page with search result, choose result, and show listing offer only container", () => {
  const { asFragment, queryByText, getByText } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <CreateOffer />
    </IntlProvider>,
  );

  // Use the act function to set the state
  act(() => {
    getByText("ProductSearchFormComponentSubmit").click();
  });

  act(() => {
    getByText("ProductSearchResultComponentSubmit").click();
  });

  const productSearchFormComponent = queryByText("ProductSearchFormComponent");
  expect(productSearchFormComponent).toBeTruthy();

  const productSearchResultComponent = queryByText(
    "ProductSearchResultComponent",
  );
  expect(productSearchResultComponent).toBeTruthy();

  const listingCreationFormComponent = queryByText(
    "ListingCreationFormComponent",
  );
  expect(listingCreationFormComponent).toBeTruthy();

  expect(asFragment()).toMatchSnapshot();
});
