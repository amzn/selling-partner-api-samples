import React from "react";
import translations from "@/app/internationalization/translations/en-US.json";
import fetch from "jest-fetch-mock";
import { IntlProvider } from "next-intl";
import ProductSearchResultComponent from "@/app/[locale]/create-offer/product-search-result-component";
import { act, screen, render } from "@testing-library/react";
import {
  mockRejectFetchResponse,
  mockResolveFetchResponse,
} from "@/app/test-utils/mock-fetch";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import DebuggingContextProvider, {
  DebugState,
} from "@/app/context/debug-context-provider";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { SPAPIRequestResponse } from "@/app/model/types";
import { US_LOCALE } from "@/app/constants/global";

const result = {
  title: "test1",
  asin: "asin1",
  productType: "productType1",
};

function renderComponent(debugState?: DebugState) {
  const handleChosenClick = jest.fn();

  const { asFragment } = render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <DebuggingContextProvider initialDebugState={debugState}>
        <IntlProvider locale={US_LOCALE} messages={translations}>
          <ProductSearchResultComponent
            result={result}
            listProduct={handleChosenClick}
          />
        </IntlProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
  return asFragment;
}

describe("Test Product Search Result component", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  test("initial render snapshot", () => {
    const asFragment = renderComponent();
    expect(asFragment()).toMatchSnapshot();
  });

  test("enables button on loading condition type", async () => {
    const routeContext = new Map<string, SPAPIRequestResponse[]>();
    let components = await act(async () => {
      mockResolveFetchResponse(200, {
        data: ["new_new", "old_old"],
        debugContext: [MOCK_SP_API_RESPONSE],
      });

      const asFragment = renderComponent({
        routeContext: routeContext,
      });
      return { asFragment };
    });

    expect(routeContext.size).toStrictEqual(0);
    await userEvent.click(screen.getByLabelText("Allowed Conditions"));

    expect(components.asFragment()).toMatchSnapshot();
    expect(routeContext.size).toStrictEqual(1);
  });

  test("disables button on empty data", async () => {
    let components = await act(async () => {
      mockResolveFetchResponse(200, {
        data: [],
        debugContext: [MOCK_SP_API_RESPONSE],
      });

      const asFragment = renderComponent();
      return { asFragment };
    });

    await userEvent.click(screen.getByLabelText("Allowed Conditions"));

    expect(components.asFragment()).toMatchSnapshot();
  });

  test("displays error on failed load", async () => {
    let components = await act(async () => {
      mockRejectFetchResponse(500);

      const asFragment = renderComponent();
      return { asFragment };
    });

    await userEvent.click(screen.getByLabelText("Allowed Conditions"));

    expect(components.asFragment()).toMatchSnapshot();
  });
});
