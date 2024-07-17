import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context";
import NavigationComponent from "@/app/[locale]/navigation-component";
import {
  SettableSettingsState,
  SettingsContext,
  SettingsState,
} from "@/app/context/settings-context-provider";
import {
  INCOMPLETE_SETTINGS,
  MOCK_SETTINGS,
  MOCK_VENDOR_CODE_SETTINGS,
} from "@/app/test-utils/mock-settings";
import userEvent from "@testing-library/user-event";
import DebuggingContextProvider, {
  DebugState,
  SettableDebugState,
} from "@/app/context/debug-context-provider";
import { SPAPIRequestResponse } from "@/app/model/types";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { SETTINGS_PAGE_PATH, US_LOCALE } from "@/app/constants/global";

const mockUsePathname = jest.fn();
const mockUseRouter = jest.fn();
const mockPush = jest.fn();

const mockSetSettingsState = (settingsState: SettingsState) => {};
const INCOMPLETE_SETTINGS_STATE: SettingsState = {
  settings: INCOMPLETE_SETTINGS,
  settingsExist: false,
};
const INCOMPLETE_SETTINGS_CONTEXT: SettableSettingsState = {
  settingsState: INCOMPLETE_SETTINGS_STATE,
  setSettingsState: mockSetSettingsState,
};

const COMPLETE_SETTINGS_STATE: SettingsState = {
  settings: MOCK_SETTINGS,
  settingsExist: true,
};
const COMPLETE_SETTINGS_CONTEXT: SettableSettingsState = {
  settingsState: COMPLETE_SETTINGS_STATE,
  setSettingsState: mockSetSettingsState,
};

const VENDOR_CODE_SETTINGS_STATE: SettingsState = {
  settings: MOCK_VENDOR_CODE_SETTINGS,
  settingsExist: true,
};
const VENDOR_CODE_SETTINGS_CONTEXT: SettableSettingsState = {
  settingsState: VENDOR_CODE_SETTINGS_STATE,
  setSettingsState: mockSetSettingsState,
};

const CREATE_OFFER_PATH = "/create-offer";

jest.mock("next/navigation", () => ({
  usePathname() {
    return mockUsePathname();
  },
  useRouter(): AppRouterInstance {
    return {
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
    };
  },
}));

function renderNavigationComponent(
  settingsState: SettableSettingsState,
  debugState?: DebugState,
) {
  return render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <DebuggingContextProvider initialDebugState={debugState}>
        <SettingsContext.Provider value={settingsState}>
          <NavigationComponent />
        </SettingsContext.Provider>
      </DebuggingContextProvider>
    </IntlProvider>,
  );
}

describe("Test for the Navigation component", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  test("Snapshot test for Testing Navigation Component in Home Page", async () => {
    mockUsePathname.mockImplementation(() => "/");
    mockUseRouter.mockImplementation(() => ({ route: "/" }));
    const { asFragment } = renderNavigationComponent(COMPLETE_SETTINGS_CONTEXT);
    expect(asFragment()).toMatchSnapshot();
  });

  test("Snapshot test for Testing Navigation Component in Create Offer page", async () => {
    mockUsePathname.mockImplementation(() => CREATE_OFFER_PATH);
    const routeContext = new Map<string, SPAPIRequestResponse[]>([
      [CREATE_OFFER_PATH, [MOCK_SP_API_RESPONSE]],
    ]);
    const { asFragment } = renderNavigationComponent(
      COMPLETE_SETTINGS_CONTEXT,
      {
        routeContext: routeContext,
      },
    );

    expect(asFragment()).toMatchSnapshot();
    await userEvent.click(screen.getByTestId("createOffer"));
    expect(routeContext.get(CREATE_OFFER_PATH)?.length).toBeFalsy();
  });

  test("verifies if the user is navigated to home page on click of home button.", async () => {
    mockUsePathname.mockImplementation(() => CREATE_OFFER_PATH);
    renderNavigationComponent(INCOMPLETE_SETTINGS_CONTEXT);
    await userEvent.click(screen.getByTestId("homeButton"));

    expect(mockPush.mock.calls[0][0]).toStrictEqual("/");
  });

  test("verifies if the user is navigated to Settings page if the settings are incomplete", async () => {
    mockUsePathname.mockImplementation(() => CREATE_OFFER_PATH);
    renderNavigationComponent(INCOMPLETE_SETTINGS_CONTEXT);
    await userEvent.click(screen.getByTestId("createOffer"));

    expect(mockPush.mock.calls[0][0]).toStrictEqual(SETTINGS_PAGE_PATH);
  });

  test("verifies if the user is navigated to same page if the settings are complete", async () => {
    mockUsePathname.mockImplementation(() => CREATE_OFFER_PATH);
    renderNavigationComponent(COMPLETE_SETTINGS_CONTEXT);
    await userEvent.click(screen.getByTestId("createOffer"));

    expect(mockPush.mock.calls[0][0]).toStrictEqual(CREATE_OFFER_PATH);
  });

  test("verifies that the createOffer button is disabled for Vendor Codes", async () => {
    mockUsePathname.mockImplementation(() => "/");
    mockUseRouter.mockImplementation(() => ({ route: "/" }));
    const { asFragment } = renderNavigationComponent(
      VENDOR_CODE_SETTINGS_CONTEXT,
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
