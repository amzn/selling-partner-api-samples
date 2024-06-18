import "@testing-library/jest-dom";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import ListingSubmitButton from "@/app/components/listing-submit-button";
import { SWRConfig } from "swr";
import fetch from "jest-fetch-mock";
import {
  mockDelayedResolveFetchResponse,
  mockRejectFetchResponse,
  mockResolveFetchResponse,
} from "@/app/test-utils/mock-fetch";
import userEvent from "@testing-library/user-event";
import {
  MOCK_LISTING_SUBMISSION_RESULT,
  MOCK_LISTING_SUBMISSION_RESULT_WITH_ISSUES,
} from "@/app/test-utils/mock-listing-submission-result";
import { afterEach } from "@jest/globals";
import DebuggingContextProvider, {
  DebugState,
} from "@/app/context/debug-context-provider";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { CREATE_OFFER_USE_CASE, US_LOCALE } from "@/app/constants/global";

const SKU = "TestSKU";
const PRODUCT_TYPE = "ProductType";
const USE_CASE = CREATE_OFFER_USE_CASE;
const BUTTON_ID = "ListingSubmitButton";

function renderListingSubmitButton(debugState?: DebugState) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider initialDebugState={debugState}>
        <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
          <ListingSubmitButton
            buttonId={BUTTON_ID}
            sku={SKU}
            productType={PRODUCT_TYPE}
            useCase={USE_CASE}
            currentListing={{}}
            initialListing={{}}
          />
        </NextIntlClientProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the ListingSubmitButton", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  afterEach(() => {
    // Cleanup any resources or state after each test
    cleanup();
  });

  test("renders the initial button with no fetch calls", async () => {
    renderListingSubmitButton();
    expect(screen.queryByTestId("backDropCircularSpinner")).toBeNull();
    expect(screen.queryByTestId("alertDialog")).toBeNull();
    expect(screen.queryByTestId("fullScreenDialog")).toBeNull();
  });

  test("renders the spinner component while loading.", async () => {
    mockDelayedResolveFetchResponse(200, {}, 60000);
    renderListingSubmitButton();
    await userEvent.click(screen.getByTestId("ListingSubmitButton"));

    expect(screen.queryByTestId("backDropCircularSpinner")).toBeVisible();
    expect(screen.queryByTestId("alertDialog")).toBeNull();
    expect(screen.queryByTestId("fullScreenDialog")).toBeNull();
  });

  test("renders the alert dialog on fetch failure.", async () => {
    mockRejectFetchResponse(400);
    renderListingSubmitButton();
    await userEvent.click(screen.getByTestId("ListingSubmitButton"));

    await waitFor(() =>
      expect(screen.queryByTestId("backDropCircularSpinner")).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("alertDialog")).toBeVisible(),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("fullScreenDialog")).toBeNull(),
    );

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();
    await userEvent.click(screen.getByTestId("cancelAlertDialog"));
    await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
  });

  test("renders the alert dialog with success message.", async () => {
    mockResolveFetchResponse(200, {
      data: MOCK_LISTING_SUBMISSION_RESULT,
      debugContext: [MOCK_SP_API_RESPONSE],
    });
    renderListingSubmitButton();
    await userEvent.click(screen.getByTestId("ListingSubmitButton"));

    await waitFor(() =>
      expect(screen.queryByTestId("backDropCircularSpinner")).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("alertDialog")).toBeVisible(),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("fullScreenDialog")).toBeNull(),
    );

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();
    await userEvent.click(screen.getByTestId("cancelAlertDialog"));
    await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
  });

  test("renders the fullscreen dialog with issues", async () => {
    mockResolveFetchResponse(200, {
      data: MOCK_LISTING_SUBMISSION_RESULT_WITH_ISSUES,
      debugContext: [MOCK_SP_API_RESPONSE],
    });
    renderListingSubmitButton();
    await userEvent.click(screen.getByTestId("ListingSubmitButton"));

    await waitFor(() =>
      expect(screen.queryByTestId("backDropCircularSpinner")).toBeNull(),
    );
    await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
    await waitFor(() =>
      expect(screen.queryByTestId("fullScreenDialog")).toBeVisible(),
    );

    expect(screen.queryByTestId("fullScreenDialog")).toMatchSnapshot();

    await userEvent.click(screen.getByTestId("cancelFullScreenDialog"));
    await waitFor(() =>
      expect(screen.queryByTestId("fullScreenDialog")).toBeNull(),
    );
  });
});
