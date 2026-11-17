import "@testing-library/jest-dom";
import {
  render,
  fireEvent,
  act,
  screen,
  cleanup,
} from "@testing-library/react";
import React from "react";
import { IntlProvider } from "next-intl";
import ProductSearchFormComponent from "@/app/[locale]/create-offer/product-search-form-component";
import { afterEach } from "@jest/globals";
import { SWRConfig } from "swr";
import userEvent from "@testing-library/user-event";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import { MOCK_CATALOG_ITEMS_API_RESPONSE } from "@/app/test-utils/mock-catalog-items-result";
import fetch from "jest-fetch-mock";
import DebuggingContextProvider, {
  DebugState,
} from "@/app/context/debug-context-provider";
import { SPAPIRequestResponse } from "@/app/model/types";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import translations from "@/app/internationalization/translations/en-US.json";
import { US_LOCALE } from "@/app/constants/global";

beforeEach(() => {
  fetch.resetMocks();
});

// Define your global afterEach function
afterEach(() => {
  // Cleanup any resources or state after each test
  cleanup();
});

function renderProductSearchFormComponent(
  handleSearchRequestSubmit: jest.Mock<any, any, any>,
  debugState?: DebugState,
) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider initialDebugState={debugState}>
        <IntlProvider locale={US_LOCALE} messages={translations}>
          <ProductSearchFormComponent
            handleSearchRequest={handleSearchRequestSubmit}
          />
        </IntlProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the ProductSearchFormComponent", () => {
  test("Snapshot Test for product search form with empty input", () => {
    // Define a mock handleSearchRequest function
    const handleSearchRequestSubmit = jest.fn();
    const { asFragment } = renderProductSearchFormComponent(
      handleSearchRequestSubmit,
    );
    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for product search form with both identifier and keyword input invalid page", () => {
    // Define a mock handleSearchRequestSubmit function
    const handleSearchRequestSubmit = jest.fn();

    const { asFragment, getByLabelText } = renderProductSearchFormComponent(
      handleSearchRequestSubmit,
    );

    // Modify the input fields
    const identifiersInput = getByLabelText("Identifiers");
    fireEvent.change(identifiersInput, { target: { value: "UPC_testtest" } });

    const keywordsInput = getByLabelText("Keywords");
    fireEvent.change(keywordsInput, { target: { value: "keywords_testtest" } });

    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for product search form with valid input", () => {
    // Define a mock handleSearchRequestSubmit function
    const handleSearchRequestSubmit = jest.fn();

    const { asFragment, getByLabelText } = renderProductSearchFormComponent(
      handleSearchRequestSubmit,
    );

    // Modify the input fields
    const identifiersInput = getByLabelText("Identifiers");
    fireEvent.change(identifiersInput, { target: { value: "UPC_testtest" } });

    // Trigger the form submission
    act(() => {
      fireEvent.submit(screen.getByTestId("productSearchRequestSubmit")); // Find form by test ID attribute
    });

    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for product search form with both identifier and keyword input combinations", async () => {
    // Define a mock handleSearchRequestSubmit function
    const handleSearchRequestSubmit = jest.fn();
    const routeContext = new Map<string, SPAPIRequestResponse[]>();

    mockResolveFetchResponse(200, {
      data: MOCK_CATALOG_ITEMS_API_RESPONSE,
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    const { asFragment, getByLabelText } = renderProductSearchFormComponent(
      handleSearchRequestSubmit,
      {
        routeContext: routeContext,
      },
    );

    // Modify the input fields
    const identifiersInput = getByLabelText("Identifiers");
    await userEvent.type(identifiersInput, "UPC_testtest");
    await userEvent.clear(identifiersInput);

    const keywordsInput = getByLabelText("Keywords");
    await userEvent.type(keywordsInput, "keywords_testtest");
    await userEvent.clear(keywordsInput);

    await userEvent.type(keywordsInput, "keywords_testtest");
    await userEvent.type(identifiersInput, "UPC_testtest");

    await userEvent.clear(keywordsInput);

    expect(routeContext.size).toStrictEqual(0);
    await act(async () => {
      await userEvent.click(screen.getByTestId("submitButton"));
    });
    expect(routeContext.size).toStrictEqual(1);
    expect(asFragment()).toMatchSnapshot();
  });
});
