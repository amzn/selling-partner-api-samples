import { afterEach } from "@jest/globals";
import { cleanup, render } from "@testing-library/react";
import { IntlProvider } from "next-intl";
import React from "react";
import translations from "@/app/internationalization/translations/en-US.json";
import CreateListing from "@/app/[locale]/create-listing/page";
import { ProductType } from "@/app/sdk/definitionsProductTypes_2020-09-01";
import { MOCK_SEARCH_PTD_RESULT } from "@/app/test-utils/mock-search-ptd-result";
import userEvent from "@testing-library/user-event";
import { US_LOCALE } from "@/app/constants/global";

/**
 * Mock the ProductTypeSearchFormComponent module
 * The detail test of logic of ProductTypeSearchFormComponent should be separate test
 */
jest.mock(
  "@/app/[locale]/create-listing/product-type-search-form-component",
  () => ({
    __esModule: true,
    default: ({
      handleSearchRequest,
    }: {
      handleSearchRequest: (results: ProductType[]) => void;
    }) => {
      return (
        <div>
          <p>ProductTypeSearchFormComponent</p>
          <button onClick={() => handleSearchRequest(MOCK_SEARCH_PTD_RESULT)}>
            ProductTypeSearchFormComponentSubmit
          </button>
        </div>
      );
    },
  }),
);

/**
 * Mock the ProductTypeChooserComponent module
 * The detail test of logic of ProductTypeChooserComponent should be separate test
 */
jest.mock(
  "@/app/[locale]/create-listing/product-type-chooser-component",
  () => ({
    __esModule: true,
    default: ({
      productTypeResults,
      handleChosenProductType,
    }: {
      productTypeResults: ProductType[];
      handleChosenProductType: (result: string) => void;
    }) => {
      return (
        <div>
          <p>ProductTypeChooserComponent</p>
          <button onClick={() => handleChosenProductType("3D_PRINTER")}>
            ProductTypeChooserComponentSubmit
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

function renderCreateListingPage() {
  const { asFragment, queryByText, getByText } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <CreateListing />
    </IntlProvider>,
  );

  return { asFragment, queryByText, getByText };
}

// Define your global afterEach function
afterEach(() => {
  // Cleanup any resources or state after each test
  cleanup();
});

describe("Test for the Create Listing Page", () => {
  test("Snapshot Test for create Listing home page ", async () => {
    const { asFragment, queryByText } = renderCreateListingPage();
    const productTypeSearchFormComponent = queryByText(
      "ProductTypeSearchFormComponent",
    );
    expect(productTypeSearchFormComponent).toBeTruthy();
    const listingCreationFormComponent = queryByText(
      "ListingCreationFormComponent",
    );
    expect(listingCreationFormComponent).toBeNull();
    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for Search by Product Type Keywords", async () => {
    const { asFragment, queryByText, getByText } = renderCreateListingPage();
    const productTypeSearchFormComponent = queryByText(
      "ProductTypeSearchFormComponent",
    );

    await userEvent.click(getByText("ProductTypeSearchFormComponentSubmit"));
    await userEvent.click(getByText("ProductTypeChooserComponentSubmit"));
    expect(productTypeSearchFormComponent).toBeTruthy();
    const listingCreationFormComponent = queryByText(
      "ListingCreationFormComponent",
    );
    expect(listingCreationFormComponent).toBeTruthy();
    expect(asFragment()).toMatchSnapshot();
  });
});
