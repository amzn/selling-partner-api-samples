import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import DebuggingContextProvider from "@/app/context/debug-context-provider";
import { IntlProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import React from "react";
import ViewSubscriptions from "@/app/[locale]/notifications/@viewSubscriptions/page";
import fetch from "jest-fetch-mock";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import userEvent from "@testing-library/user-event";
import {
  MOCK_SUBSCRIPTION_1,
  MOCK_SUBSCRIPTION_2,
} from "@/app/test-utils/mock-subscription";
import { US_LOCALE } from "@/app/constants/global";

function renderViewSubscriptions() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider>
        <IntlProvider locale={US_LOCALE} messages={translations}>
          <ViewSubscriptions />
        </IntlProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the ViewSubscriptions", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  test("snapshot test which verifies if the subscription data is rendered properly", async () => {
    mockResolveFetchResponse(200, {
      data: [MOCK_SUBSCRIPTION_1, MOCK_SUBSCRIPTION_2],
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    await renderAndValidate();
  });

  test("snapshot test which verifies if alert is displayed when there are no subscriptions", async () => {
    mockResolveFetchResponse(200, {
      data: [],
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    await renderAndValidate();
  });
});

async function renderAndValidate() {
  const { asFragment } = renderViewSubscriptions();
  expect(asFragment()).toMatchSnapshot();

  await waitFor(() =>
    expect(screen.queryByTestId("getSubscriptionsButton")).not.toBeNull(),
  );
  await act(async () => {
    await userEvent.click(screen.getByTestId("getSubscriptionsButton"));
  });
  expect(asFragment()).toMatchSnapshot();
}
