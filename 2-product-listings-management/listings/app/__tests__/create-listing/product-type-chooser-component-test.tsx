import fetch from "jest-fetch-mock";
import { afterEach } from "@jest/globals";
import { cleanup, render } from "@testing-library/react";
import { SWRConfig } from "swr";
import DebuggingContextProvider, {
  DebugState,
} from "@/app/context/debug-context-provider";
import { IntlProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import React from "react";
import ProductTypeChooserComponent from "@/app/[locale]/create-listing/product-type-chooser-component";
import userEvent from "@testing-library/user-event";
import {
  MOCK_SEARCH_PTD_RESULT,
  MOCK_SEARCH_SINGLE_PTD_RESULT,
} from "@/app/test-utils/mock-search-ptd-result";
import { ProductType } from "@/app/sdk/definitionsProductTypes_2020-09-01";
import { US_LOCALE } from "@/app/constants/global";

beforeEach(() => {
  fetch.resetMocks();
});

// Define your global afterEach function
afterEach(() => {
  // Cleanup any resources or state after each test
  cleanup();
});

function renderProductTypeChooserComponent(
  handleChosenProductType: jest.Mock<any, any, any>,
  productTypes: ProductType[],
  debugState?: DebugState,
) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider initialDebugState={debugState}>
        <IntlProvider locale={US_LOCALE} messages={translations}>
          <ProductTypeChooserComponent
            productTypeResults={productTypes}
            handleChosenProductType={handleChosenProductType}
          />
        </IntlProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the ProductTypeChooserComponent", () => {
  test("Basic Snapshot Test for product type chooser component", () => {
    // Define a mock handleSearchRequest function
    const handleChosenProductType = jest.fn();
    const { asFragment } = renderProductTypeChooserComponent(
      handleChosenProductType,
      MOCK_SEARCH_PTD_RESULT,
    );
    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for product type chooser component after choosing a product type", async () => {
    // Define a mock handleSearchRequest function
    const handleChosenProductType = jest.fn();
    const { asFragment, getByRole, getAllByRole } =
      renderProductTypeChooserComponent(
        handleChosenProductType,
        MOCK_SEARCH_PTD_RESULT,
      );

    await userEvent.click(getByRole("button", { name: /3D_PRINTER/i }));

    const optionComponentList = getAllByRole("option");
    const targetOptionComponent = optionComponentList[1];

    await userEvent.click(targetOptionComponent);

    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for product type chooser component after no search results", async () => {
    // Define a mock handleSearchRequest function
    const handleChosenProductType = jest.fn();
    const { asFragment, getByRole, getAllByRole } =
      renderProductTypeChooserComponent(handleChosenProductType, []);

    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for product type chooser component after a single search result", async () => {
    // Define a mock handleSearchRequest function
    const handleChosenProductType = jest.fn();
    const { asFragment } = renderProductTypeChooserComponent(
      handleChosenProductType,
      MOCK_SEARCH_SINGLE_PTD_RESULT,
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
