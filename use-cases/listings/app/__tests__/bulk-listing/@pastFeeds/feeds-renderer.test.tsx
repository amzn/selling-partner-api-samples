import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import DebuggingContextProvider from "@/app/context/debug-context-provider";
import { IntlProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import React from "react";
import FeedsRenderer from "@/app/[locale]/bulk-listing/@pastFeeds/feeds-renderer";
import { MOCK_FEED_1 } from "@/app/test-utils/mock-feed";
import userEvent from "@testing-library/user-event";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { saveAs } from "file-saver";
import { Feed } from "@/app/model/types";
import { JSON_FILE_TYPE, US_LOCALE } from "@/app/constants/global";

jest.mock("file-saver");
const mockedSaveAs = jest.mocked(saveAs);

function renderComponent(feeds: Feed[]) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider>
        <IntlProvider locale={US_LOCALE} messages={translations}>
          <FeedsRenderer feeds={feeds} />
        </IntlProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

async function renderAndTriggerDownload() {
  mockResolveFetchResponse(200, {
    data: {
      content: "Report",
      contentType: JSON_FILE_TYPE,
    },
    debugContext: [MOCK_SP_API_RESPONSE],
  });

  const { asFragment } = renderComponent([MOCK_FEED_1]);
  await waitFor(() =>
    expect(screen.queryByTestId("downloadProcessingReport-0")).not.toBeNull(),
  );
  await act(async () => {
    await userEvent.click(screen.getByTestId("downloadProcessingReport-0"));
  });
  await waitFor(() =>
    expect(screen.queryByTestId("alertDialog")).not.toBeNull(),
  );
  expect(asFragment()).toMatchSnapshot();
  expect(screen.getByTestId("alertDialog")).toMatchSnapshot();
}

describe("Test for the FeedsRenderer", () => {
  test("snapshot test on successful download of processing report", async () => {
    mockedSaveAs.mockImplementation(() => {});
    await renderAndTriggerDownload();
  });
});
