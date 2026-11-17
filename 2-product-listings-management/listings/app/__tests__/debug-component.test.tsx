import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import DebuggingContextProvider, {
  DebugState,
} from "@/app/context/debug-context-provider";
import DebugComponent from "@/app/[locale]/debug-component";
import { SPAPIRequestResponse } from "@/app/model/types";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import { usePathname } from "next/navigation";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { US_LOCALE } from "@/app/constants/global";

jest.mock("next/navigation");
const mockedPathName = jest.mocked(usePathname);

const CREATE_OFFER_PATH = "/create-offer";

function renderDebugComponent(debugState: DebugState) {
  return render(
    <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
      <DebuggingContextProvider initialDebugState={debugState}>
        <DebugComponent />
      </DebuggingContextProvider>
    </NextIntlClientProvider>,
  );
}

describe("Test for the DebugComponent", () => {
  test("verifies if the debug console renders properly.", async () => {
    mockedPathName.mockReturnValue(CREATE_OFFER_PATH);
    const routeContext = new Map<string, SPAPIRequestResponse[]>([
      [CREATE_OFFER_PATH, [MOCK_SP_API_RESPONSE]],
    ]);
    const { asFragment } = renderDebugComponent({
      routeContext: routeContext,
    });
    expect(asFragment()).toMatchSnapshot();
    await userEvent.click(screen.getByTestId("debugButton"));
    await waitFor(() =>
      expect(screen.queryByTestId("fullScreenDialog")).not.toBeNull(),
    );

    expect(routeContext.get(CREATE_OFFER_PATH)?.length).toStrictEqual(1);
    expect(screen.getByTestId("fullScreenDialog")).toMatchSnapshot();
    await userEvent.click(screen.getByTestId("actionButton"));
    expect(routeContext.get(CREATE_OFFER_PATH)?.length).toStrictEqual(0);

    await userEvent.click(screen.getByTestId("cancelFullScreenDialog"));
    await waitFor(() =>
      expect(screen.queryByTestId("fullScreenDialog")).toBeNull(),
    );
  });

  test("verifies the debug console is disabled for settings page.", async () => {
    mockedPathName.mockReturnValue("/settings");
    renderDebugComponent({
      routeContext: new Map<string, SPAPIRequestResponse[]>(),
    });
    await waitFor(() => expect(screen.queryByTestId("debugButton")).toBeNull());
  });
});
