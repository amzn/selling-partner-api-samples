import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import React from "react";
import userEvent from "@testing-library/user-event";
import { createJsonFile } from "@/app/test-utils/mock-file";
import DebuggingContextProvider from "@/app/context/debug-context-provider";
import translations from "@/app/internationalization/translations/en-US.json";
import { SWRConfig } from "swr";
import { IntlProvider } from "next-intl";
import UploadFeeds from "@/app/[locale]/bulk-listing/@uploadFeeds/page";
import fetch from "jest-fetch-mock";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { US_LOCALE } from "@/app/constants/global";

function renderUploadFeeds() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider>
        <IntlProvider locale={US_LOCALE} messages={translations}>
          <UploadFeeds />
        </IntlProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the Upload Feeds page", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  test("successful creation of the feed", async () => {
    mockResolveFetchResponse(200, {
      data: {
        feedId: 12345,
      },
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    const { asFragment } = renderUploadFeeds();

    await act(async () => {
      await userEvent.upload(
        screen.getByTestId("hiddenFileInput"),
        createJsonFile("Json"),
      );
      const feedContentField = screen.getByLabelText("Feed Content");
      await userEvent.clear(feedContentField);
      await userEvent.type(feedContentField, "Json");
      await userEvent.click(screen.getByTestId("submitFeed"));
    });
    expect(screen.queryByTestId("alertDialog")).toBeVisible();

    expect(asFragment()).toMatchSnapshot();
    expect(screen.getByTestId("alertDialog")).toMatchSnapshot();
  });
});
