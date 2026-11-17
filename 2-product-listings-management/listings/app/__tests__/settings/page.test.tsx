import Settings from "@/app/[locale]/settings/page";
import { act, screen, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { IntlProvider } from "next-intl";
import React from "react";
import fetch from "jest-fetch-mock";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import translations from "@/app/internationalization/translations/en-US.json";
import SettingsProvider from "@/app/context/settings-context-provider";
import { US_LOCALE } from "@/app/constants/global";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import userEvent from "@testing-library/user-event";

function renderSettings() {
  return render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <SettingsProvider
        initialSettingsExist={false}
        initialSettings={MOCK_SETTINGS}
      >
        <Settings />
      </SettingsProvider>
    </IntlProvider>,
  );
}

describe("Test Settings Page", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  test("snapshot", async () => {
    let fragment = await act(async () => {
      const { asFragment } = renderSettings();
      return asFragment;
    });

    expect(fragment()).toMatchSnapshot();
  });

  test("saves settings and displays alert on success", async () => {
    mockResolveFetchResponse(200, {
      data: {},
    });

    let components = await act(async () => {
      const { asFragment, getByLabelText, getByRole, getByTestId } =
        renderSettings();
      return { asFragment, getByLabelText, getByRole, getByTestId };
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId("save"));
    });

    await waitFor(() =>
      expect(screen.queryByTestId("alertDialog")).toBeVisible(),
    );
    expect(components.asFragment()).toMatchSnapshot();
  });
});
