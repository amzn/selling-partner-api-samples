import Home from "@/app/[locale]/page";
import { render } from "@testing-library/react";
import { US_LOCALE } from "@/app/constants/global";
import translations from "@/app/internationalization/translations/en-US.json";
import { NextIntlProvider } from "next-intl";

describe("Test for the Home page", () => {
  test("Snapshot Test for the Home component", () => {
    const { asFragment } = render(
      <NextIntlProvider locale={US_LOCALE} messages={translations}>
        <Home />
      </NextIntlProvider>,
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
