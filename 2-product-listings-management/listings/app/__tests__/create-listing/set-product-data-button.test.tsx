import { act, screen, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NextIntlProvider } from "next-intl";
import React from "react";
import fetch from "jest-fetch-mock";
import translations from "@/app/internationalization/translations/en-US.json";
import { US_LOCALE } from "@/app/constants/global";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import userEvent from "@testing-library/user-event";
import AlertProvider from "@/app/context/alert-context-provider";
import SetProductDataButton from "@/app/components/set-product-data-button";

const MOCK_VARIATION_JSON_PROPERTY = "parentage_level";
const MOCK_PARENT_JSON_PROPERTY_VALUE = {
  value: "parent",
};
const MOCK_BUTTON_ID = "test-save-product-data-button";
const MOCK_BUTTON_TEXT = "test-button";
const MOCK_BUTTON_ALERT = "test-alert";
let MOCK_LISTING = {};
const MOCK_SET_DATA = (data: any) => {
  return data;
};

function renderSetProductDataButton() {
  return render(
    <NextIntlProvider locale={US_LOCALE} messages={translations}>
      <AlertProvider>
        <SetProductDataButton
          property={{
            propertyName: MOCK_VARIATION_JSON_PROPERTY,
            propertyValue: MOCK_PARENT_JSON_PROPERTY_VALUE,
          }}
          buttonId={MOCK_BUTTON_ID}
          buttonText={MOCK_BUTTON_TEXT}
          buttonAlert={MOCK_BUTTON_ALERT}
          existingData={MOCK_LISTING}
          setData={MOCK_SET_DATA}
        />
      </AlertProvider>
    </NextIntlProvider>,
  );
}

describe("Test Set Product Data Button", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  test("Test alert displays on button click.", async () => {
    mockResolveFetchResponse(200, {
      data: {},
    });

    let components = await act(async () => {
      const { asFragment, getByLabelText, getByRole, getByTestId } =
        renderSetProductDataButton();
      return { asFragment, getByLabelText, getByRole, getByTestId };
    });

    await act(async () => {
      await userEvent.click(
        screen.getByTestId("test-save-product-data-button"),
      );
    });

    await waitFor(() =>
      expect(screen.queryByTestId("product-data-set")).toBeVisible(),
    );
    expect(components.asFragment()).toMatchSnapshot();
  });
});
