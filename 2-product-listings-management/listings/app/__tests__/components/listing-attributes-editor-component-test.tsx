import "@testing-library/jest-dom";
import fetch from "jest-fetch-mock";
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import ListingAttributesEditorComponent from "@/app/components/listing-attributes-editor-component";
import { SWRConfig } from "swr";
import translations from "@/app/internationalization/translations/en-US.json";
import { MOCK_SCHEMA } from "@/app/test-utils/mock-schema";
import {
  mockDelayedResolveFetchResponse,
  mockRejectFetchResponse,
  mockResolveFetchResponse,
} from "@/app/test-utils/mock-fetch";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import DebuggingContextProvider from "@/app/context/debug-context-provider";
import { CREATE_OFFER_USE_CASE, US_LOCALE } from "@/app/constants/global";

// This is needed for the snapshot of JsonForms.
window.matchMedia = jest.fn().mockImplementation((query) => {
  return {
    matches: true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };
});

const SKU: string = "SKU";
const LUGGAGE_PTD = "LUGGAGE";
const USE_CASE = CREATE_OFFER_USE_CASE;

function renderListingAttributesEditorComponent() {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider>
        <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
          <ListingAttributesEditorComponent
            sku={SKU}
            productType={LUGGAGE_PTD}
            useCase={USE_CASE}
            initialListing={{}}
          />
        </NextIntlClientProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the ListingAttributesEditorComponent", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  test("renders the spinner component while loading.", async () => {
    mockDelayedResolveFetchResponse(200, MOCK_SCHEMA, 60000);
    renderListingAttributesEditorComponent();

    expect(screen.getByTestId("backDropCircularSpinner")).toBeVisible();
    expect(screen.queryByTestId("listingAttributesEditor")).toBeNull();
    expect(screen.queryByTestId("alertDialog")).toBeNull();
  });

  test("renders the alert dialog on schema fetch failure.", async () => {
    mockRejectFetchResponse(400);
    renderListingAttributesEditorComponent();

    await waitForElementToBeRemoved(
      screen.getByTestId("backDropCircularSpinner"),
    );
    await screen.findByTestId("alertDialog");
    expect(screen.getByTestId("alertDialog")).toBeVisible();
    expect(screen.queryByTestId("listingAttributesEditor")).toBeNull();
  });

  test("renders the UI based on the fetched schema.", async () => {
    mockResolveFetchResponse(200, {
      data: MOCK_SCHEMA,
      debugContext: [MOCK_SP_API_RESPONSE],
    });
    renderListingAttributesEditorComponent();

    await waitForElementToBeRemoved(
      screen.getByTestId("backDropCircularSpinner"),
    );
    expect(screen.queryByTestId("alertDialog")).toBeNull();
    await screen.findByTestId("listingAttributesEditor");
    const listingAttributesEditor = screen.getByTestId(
      "listingAttributesEditor",
    );
    expect(listingAttributesEditor).toBeVisible();
    expect(listingAttributesEditor).toMatchSnapshot();
  });
});
