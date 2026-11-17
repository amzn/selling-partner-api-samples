import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";
import DebuggingContextProvider from "@/app/context/debug-context-provider";
import { IntlProvider } from "next-intl";
import PastFeeds from "@/app/[locale]/bulk-listing/@pastFeeds/page";
import translations from "@/app/internationalization/translations/en-US.json";
import fetch from "jest-fetch-mock";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import { MOCK_FEED_1, MOCK_FEED_2 } from "@/app/test-utils/mock-feed";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import userEvent from "@testing-library/user-event";
import { US_LOCALE } from "@/app/constants/global";

function renderPastFeeds() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider>
        <IntlProvider locale={US_LOCALE} messages={translations}>
          <PastFeeds />
        </IntlProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}
describe("Test for the Past Feeds page", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  test("snapshot test which verifies if the feed data is rendered properly", async () => {
    mockResolveFetchResponse(200, {
      data: [MOCK_FEED_1, MOCK_FEED_2],
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    await renderAndValidate();
  });

  test("snapshot test which verifies if the alert is displayed for no feeds", async () => {
    mockResolveFetchResponse(200, {
      data: [],
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    await renderAndValidate();
  });
});

async function renderAndValidate() {
  const { asFragment } = renderPastFeeds();
  expect(asFragment()).toMatchSnapshot();

  await waitFor(() =>
    expect(screen.queryByTestId("getFeedsButton")).not.toBeNull(),
  );
  await act(async () => {
    await userEvent.click(screen.getByTestId("getFeedsButton"));
  });
  expect(asFragment()).toMatchSnapshot();
}
