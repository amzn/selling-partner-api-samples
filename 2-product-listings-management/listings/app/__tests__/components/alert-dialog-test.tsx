import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { NextIntlClientProvider } from "next-intl";
import AlertDialog from "@/app/components/alert-dialog";
import userEvent from "@testing-library/user-event";
import translations from "@/app/internationalization/translations/en-US.json";
import { US_LOCALE } from "@/app/constants/global";

function renderAlertDialog() {
  render(
    <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
      <AlertDialog title={"Error"} content={"Try again."} onClose={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("Test for the AlertDialog component", () => {
  test("renders properly with the initial state", async () => {
    renderAlertDialog();

    await screen.findByTestId("alertDialog");
    const alertDialog = screen.getByTestId("alertDialog");
    expect(alertDialog).toMatchSnapshot();
  });

  test("closes on click of the cancel button.", async () => {
    renderAlertDialog();

    await userEvent.click(screen.getByTestId("cancelAlertDialog"));
    await waitForElementToBeRemoved(screen.getByTestId("cancelAlertDialog"));

    expect(screen.queryByTestId("cancelAlertDialog")).toBeNull();
    expect(screen.queryByTestId("alertDialog")).toBeNull();
  });
});
