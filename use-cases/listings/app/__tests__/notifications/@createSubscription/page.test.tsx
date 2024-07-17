import CreateSubscription from "@/app/[locale]/notifications/@createSubscription/page";
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
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { MOCK_CREATE_SUBSCRIPTION_RESULT_1 } from "@/app/test-utils/mock-subscription";
import { US_LOCALE } from "@/app/constants/global";

function renderPage() {
  const { asFragment, queryByText, getByText } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <CreateSubscription />
    </IntlProvider>,
  );

  return { asFragment, queryByText, getByText };
}

describe("Tests for the CreateSubscription", () => {
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

  test("CreateSubscription Error Test", async () => {
    mockRejectFetchResponse(500);
    renderPage();

    await userEvent.click(screen.getByTestId("submitCreateSubscription"));
    await waitFor(() => {
      const dialog = screen.queryByText("Please try again", { exact: false });
      expect(dialog).not.toBeNull();
      expect(dialog).toBeVisible();
    });
    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();
    await userEvent.click(screen.getByTestId("cancelAlertDialog"));
    await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
  });

  test("CreateSubscription Success Test", async () => {
    mockResolveFetchResponse(200, {
      data: MOCK_CREATE_SUBSCRIPTION_RESULT_1,
      debugContext: [MOCK_SP_API_RESPONSE],
    });
    renderPage();

    await userEvent.click(screen.getByTestId("submitCreateSubscription"));
    await waitFor(() => {
      const dialog = screen.queryByText("Created subscription successfully", {
        exact: false,
      });
      expect(dialog).not.toBeNull();
      expect(dialog).toBeVisible();
    });

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();

    await userEvent.click(screen.getByTestId("cancelAlertDialog"));
    await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
  });

  test("CreateSubscription Success Test For Conflicting resource", async () => {
    mockResolveFetchResponse(200, {
      data: {},
      debugContext: [MOCK_SP_API_RESPONSE],
    });
    renderPage();

    await userEvent.click(screen.getByTestId("submitCreateSubscription"));
    await waitFor(() => {
      const dialog = screen.queryByText("Subscription already exists", {
        exact: false,
      });
      expect(dialog).not.toBeNull();
      expect(dialog).toBeVisible();
    });

    expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();

    await userEvent.click(screen.getByTestId("cancelAlertDialog"));
    await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
  });
});
