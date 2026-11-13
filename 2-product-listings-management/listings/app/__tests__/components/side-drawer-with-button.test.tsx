import "@testing-library/jest-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import { SWRConfig } from "swr";
import { mockDelayedResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import userEvent from "@testing-library/user-event";
import { afterEach } from "@jest/globals";
import DebuggingContextProvider, {
  DebugState,
} from "@/app/context/debug-context-provider";
import { US_LOCALE } from "@/app/constants/global";
import SideDrawerWithButtonComponent from "@/app/components/side-drawer-with-button";

const CHILD = <p>test</p>;
const DRAWER_ID = "ListingAttributesSubmissionSideDrawer";

function renderSideDrawerWithButton(debugState?: DebugState) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider initialDebugState={debugState}>
        <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
          <SideDrawerWithButtonComponent drawerId={DRAWER_ID} child={CHILD} />
        </NextIntlClientProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the Side Drawer", () => {
  afterEach(() => {
    // Cleanup any resources or state after each test
    cleanup();
  });

  test("renders the initial button without button click", async () => {
    renderSideDrawerWithButton();
    expect(
      screen.queryByTestId("drawerListingAttributesSubmissionSideDrawer"),
    ).toBeNull();
    expect(
      screen.queryByTestId("toolTipListingAttributesSubmissionSideDrawer"),
    ).toBeVisible();
    expect(
      screen.queryByTestId("buttonListingAttributesSubmissionSideDrawer"),
    ).toBeVisible();
  });

  test("renders the drawer after clicking the button.", async () => {
    mockDelayedResolveFetchResponse(200, {}, 60000);
    renderSideDrawerWithButton();
    await userEvent.click(
      screen.getByTestId("buttonListingAttributesSubmissionSideDrawer"),
    );
    expect(
      screen.queryByTestId("drawerListingAttributesSubmissionSideDrawer"),
    ).toBeVisible();
    expect(
      screen.queryByTestId("drawerListingAttributesSubmissionSideDrawer"),
    ).toMatchSnapshot();
  });
});
