import "@testing-library/jest-dom";
import ConvertToJsonFeed from "@/app/components/convert-to-json-feed-button";
import { act, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import SettingsProvider, {
  SettableSettingsState,
  SettingsContext,
  SettingsState,
} from "@/app/context/settings-context-provider";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import userEvent from "@testing-library/user-event";
import saveAs from "file-saver";
import {
  CREATE_OFFER_USE_CASE,
  UPDATE_LISTING_USE_CASE,
  US_LOCALE,
} from "@/app/constants/global";

jest.mock("file-saver");
const mockedSaveAs = jest.mocked(saveAs);
mockedSaveAs.mockImplementation(() => {});

const SKU: string = "SKU";
const currentListing = {
  item_name: [
    {
      value: "Title",
    },
  ],
};

function renderConvertToJsonFeedButton(
  currentListing: object,
  initialListing: object,
  useCase: string,
) {
  return render(
    <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
      <SettingsProvider
        initialSettings={MOCK_SETTINGS}
        initialSettingsExist={true}
      >
        <ConvertToJsonFeed
          sku={SKU}
          initialListing={initialListing}
          listing={currentListing}
          useCase={useCase}
          productType={"LUGGAGE"}
        />
      </SettingsProvider>
    </NextIntlClientProvider>,
  );
}

async function verifyAlertDialog() {
  await waitFor(() =>
    expect(screen.queryByTestId("alertDialog")).toBeVisible(),
  );
  expect(screen.queryByTestId("alertDialog")).toMatchSnapshot();

  await userEvent.click(screen.getByTestId("cancelAlertDialog"));
  await waitFor(() => expect(screen.queryByTestId("alertDialog")).toBeNull());
}

describe("Test for the ConvertToJsonFeed button", () => {
  test("verifies if the button click saves the file and shows success alert", async () => {
    const { asFragment } = renderConvertToJsonFeedButton(
      currentListing,
      {},
      CREATE_OFFER_USE_CASE,
    );
    expect(asFragment()).toMatchSnapshot();
    await userEvent.click(screen.getByTestId("convertToJsonFeed"));
    await verifyAlertDialog();
  });

  test("verifies if the button click shows failure alert on empty patches", async () => {
    const { asFragment } = renderConvertToJsonFeedButton(
      currentListing,
      currentListing,
      UPDATE_LISTING_USE_CASE,
    );
    await userEvent.click(screen.getByTestId("convertToJsonFeed"));
    await verifyAlertDialog();
  });
});
