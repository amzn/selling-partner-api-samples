import "@testing-library/jest-dom";
import fetch from "jest-fetch-mock";
import DebuggingContextProvider, {
  DebugState,
} from "@/app/context/debug-context-provider";
import { SPAPIRequestResponse } from "@/app/model/types";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { afterEach } from "@jest/globals";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import React from "react";
import ProductTypeSearchFormComponent from "@/app/[locale]/create-listing/product-type-search-form-component";
import { NextIntlProvider } from "next-intl";
import userEvent from "@testing-library/user-event";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import translations from "@/app/internationalization/translations/en-US.json";
import { MOCK_SEARCH_PTD_RESULT } from "@/app/test-utils/mock-search-ptd-result";
import { MOCK_SEARCH_SINGLE_PTD_RESULT } from "@/app/test-utils/mock-search-ptd-result";
import { US_LOCALE } from "@/app/constants/global";

beforeEach(() => {
  fetch.resetMocks();
});

// Define your global afterEach function
afterEach(() => {
  // Cleanup any resources or state after each test
  cleanup();
});

function renderProductTypeSearchFormComponent(
  handleSearchRequestSubmit: jest.Mock<any, any, any>,
  debugState?: DebugState,
) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider initialDebugState={debugState}>
        <NextIntlProvider locale={US_LOCALE} messages={translations}>
          <ProductTypeSearchFormComponent
            handleSearchRequest={handleSearchRequestSubmit}
          />
        </NextIntlProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the ProductTypeSearchFormComponent", () => {
  test("Snapshot Test for product type search form with empty input", () => {
    // Define a mock handleSearchRequest function
    const handleSearchRequestSubmit = jest.fn();
    const { asFragment } = renderProductTypeSearchFormComponent(
      handleSearchRequestSubmit,
    );
    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for product type search form with keyword input valid page", async () => {
    // Define a mock handleSearchRequestSubmit function
    const handleSearchRequestSubmit = jest.fn();
    const routeContext = new Map<string, SPAPIRequestResponse[]>();

    mockResolveFetchResponse(200, {
      data: MOCK_SEARCH_PTD_RESULT,
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    const { asFragment, getByLabelText } = renderProductTypeSearchFormComponent(
      handleSearchRequestSubmit,
      {
        routeContext: routeContext,
      },
    );

    // Modify the input fields
    const keywordsInput = getByLabelText("Keywords");
    await userEvent.type(keywordsInput, "keywords_testtest");

    expect(routeContext.size).toStrictEqual(0);
    await act(async () => {
      await userEvent.click(screen.getByTestId("submitButton"));
    });

    expect(routeContext.size).toStrictEqual(1);

    await waitFor(() => {
      expect(
        screen
          .queryByTestId("submitButton")
          ?.querySelector(".MuiTouchRipple-ripple"),
      ).toBeNull();
    });

    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for product type search form with itemName input valid page", async () => {
    // Define a mock handleSearchRequestSubmit function
    const handleSearchRequestSubmit = jest.fn();
    const routeContext = new Map<string, SPAPIRequestResponse[]>();

    mockResolveFetchResponse(200, {
      data: MOCK_SEARCH_SINGLE_PTD_RESULT,
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    const { asFragment, getByLabelText } = renderProductTypeSearchFormComponent(
      handleSearchRequestSubmit,
      {
        routeContext: routeContext,
      },
    );

    // Modify the input fields
    const itemNameInput = getByLabelText("ItemName");
    await userEvent.type(itemNameInput, "itemName_testtest");

    expect(routeContext.size).toStrictEqual(0);
    await act(async () => {
      await userEvent.click(screen.getByTestId("submitButton"));
    });

    expect(routeContext.size).toStrictEqual(1);

    await waitFor(() => {
      expect(
        screen
          .queryByTestId("submitButton")
          ?.querySelector(".MuiTouchRipple-ripple"),
      ).toBeNull();
    });

    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot Test for product type search form with both keywords and itemName input combinations", async () => {
    // Define a mock handleSearchRequestSubmit function
    const handleSearchRequestSubmit = jest.fn();
    const routeContext = new Map<string, SPAPIRequestResponse[]>();

    mockResolveFetchResponse(200, {
      data: MOCK_SEARCH_SINGLE_PTD_RESULT,
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    const { asFragment, getByLabelText } = renderProductTypeSearchFormComponent(
      handleSearchRequestSubmit,
      {
        routeContext: routeContext,
      },
    );

    // Modify the input fields
    const itemNameInput = getByLabelText("ItemName");
    await userEvent.type(itemNameInput, "itemName_testtest");
    await userEvent.clear(itemNameInput);

    const keywordsInput = getByLabelText("Keywords");
    await userEvent.type(keywordsInput, "keywords_testtest");
    await userEvent.clear(keywordsInput);

    await userEvent.type(keywordsInput, "keywords_testtest");
    await userEvent.type(itemNameInput, "UPC_testtest");

    // Assert the submit button is disabled
    const submitButton = screen.getByTestId("submitButton");
    expect(submitButton).toBeDisabled();

    expect(asFragment()).toMatchSnapshot();

    await userEvent.clear(keywordsInput);

    // Assert the submit button is enabled
    expect(submitButton).toBeEnabled();

    expect(asFragment()).toMatchSnapshot();

    await act(async () => {
      await userEvent.click(submitButton);
    });
    expect(routeContext.size).toStrictEqual(1);
  });
});
