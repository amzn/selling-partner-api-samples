import { act, cleanup, render, screen } from "@testing-library/react";
import { IntlProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import UpdateListing from "@/app/[locale]/update-listing/page";
import fetch from "jest-fetch-mock";
import {
  mockRejectFetchResponse,
  mockResolveFetchResponse,
} from "@/app/test-utils/mock-fetch";
import { MOCK_GET_LISTINGS_ITEM_API_SUCCESS_RESPONSE } from "@/app/test-utils/mock-listings-item-result";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import userEvent from "@testing-library/user-event";
import React from "react";
import { US_LOCALE } from "@/app/constants/global";

function MockedListingUpdateComponent() {
  return <div> Mocked Listing Update Component </div>;
}

jest.mock(
  "@/app/[locale]/update-listing/listing-update-component",
  () => MockedListingUpdateComponent,
);

function renderPage() {
  const { asFragment } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <UpdateListing />
    </IntlProvider>,
  );

  return { asFragment };
}

describe("Tests for Update Listing page", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  afterEach(() => {
    // Cleanup any resources or state after each test
    cleanup();
  });

  test("Initial Render", async () => {
    const { asFragment } = renderPage();
    expect(asFragment()).toMatchSnapshot();
  });

  test("Attributes editor is shown when listing is present", async () => {
    mockResolveFetchResponse(200, {
      data: MOCK_GET_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    const fragment = renderPage();

    const byRole = screen.getByRole("textbox");

    await act(async () => {
      await userEvent.type(byRole, "SKU_testtest");
      await userEvent.click(screen.getByText("Retrieve SKU"));
    });

    expect(fragment.asFragment()).toMatchSnapshot();
  });

  test("Attributes editor is not shown when listing is not present", async () => {
    mockRejectFetchResponse(400);

    const fragment = renderPage();

    const byRole = screen.getByRole("textbox");
    await act(async () => {
      await userEvent.type(byRole, "SKU_testtest");
      await userEvent.click(screen.getByText("Retrieve SKU"));
    });

    expect(fragment.asFragment()).toMatchSnapshot();
  });
});
