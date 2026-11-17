import Page from "@/app/[locale]/delete-listing/page";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import "@testing-library/react";
import { IntlProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import {
  mockRejectFetchResponse,
  mockResolveFetchResponse,
} from "@/app/test-utils/mock-fetch";
import userEvent from "@testing-library/user-event";
import fetch from "jest-fetch-mock";
import { MOCK_DELETE_LISTINGS_ITEM_API_SUCCESS_RESPONSE } from "@/app/test-utils/mock-listings-item-result";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { US_LOCALE } from "@/app/constants/global";

function renderPage() {
  const { asFragment, queryByText, getByText } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <Page />
    </IntlProvider>,
  );

  return { asFragment, queryByText, getByText };
}

describe("Tests for the Delete Listing Page", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  afterEach(() => {
    // Cleanup any resources or state after each test
    cleanup();
  });

  test("Snapshot Test", async () => {
    const { asFragment } = renderPage();
    expect(asFragment()).toMatchSnapshot();
  });

  test("Delete Error Test", async () => {
    mockRejectFetchResponse(500);
    renderPage();

    const byRole = screen.getByRole("textbox");
    await userEvent.type(byRole, "SKU_testtest");

    await userEvent.click(screen.getByText("Delete this listing"));

    await waitFor(() => {
      const dialog = screen.queryByText("Are you sure", { exact: false });
      expect(dialog).not.toBeNull();
      expect(dialog).toBeVisible();
    });

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();

    await userEvent.click(screen.getByTestId("confirmAlertDialog"));

    await waitFor(() => {
      const dialog = screen.queryByText("Please try again", { exact: false });
      expect(dialog).not.toBeNull();
      expect(dialog).toBeVisible();
    });

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();

    await userEvent.click(screen.getByTestId("cancelAlertDialog"));
    await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
  });

  test("Delete Success Test", async () => {
    mockResolveFetchResponse(200, {
      data: MOCK_DELETE_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
      debugContext: [MOCK_SP_API_RESPONSE],
    });
    renderPage();

    const byRole = screen.getByRole("textbox");
    await userEvent.type(byRole, "SKU_testtest");

    await userEvent.click(screen.getByText("Delete this listing"));

    await waitFor(() => {
      const dialog = screen.queryByText("Are you sure", { exact: false });
      expect(dialog).not.toBeNull();
      expect(dialog).toBeVisible();
    });

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();

    await userEvent.click(screen.getByTestId("confirmAlertDialog"));

    await waitFor(() => {
      const dialog = screen.queryByText("Success", { exact: false });
      expect(dialog).not.toBeNull();
      expect(dialog).toBeVisible();
    });

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();

    await userEvent.click(screen.getByTestId("cancelAlertDialog"));
    await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
  });

  test("Delete Cancel Test", async () => {
    renderPage();

    const byRole = screen.getByRole("textbox");
    await userEvent.type(byRole, "SKU_testtest");

    await userEvent.click(screen.getByText("Delete this listing"));

    await waitFor(() => {
      const dialog = screen.queryByText("Are you sure", { exact: false });
      expect(dialog).not.toBeNull();
      expect(dialog).toBeVisible();
    });

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();

    await userEvent.click(screen.getByTestId("cancelAlertDialog"));
    await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
  });
});
