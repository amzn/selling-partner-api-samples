import Home from "@/app/[locale]/page";
import { render } from "@testing-library/react";
import { US_LOCALE } from "@/app/constants/global";
import translations from "@/app/internationalization/translations/en-US.json";
import { IntlProvider } from "next-intl";

describe("Test for the Home page", () => {
  test("Snapshot Test for the Home component", () => {
    const { asFragment } = render(
      <IntlProvider locale={US_LOCALE} messages={translations}>
        <Home />
      </IntlProvider>,
    );
    expect(asFragment()).toMatchSnapshot();
  });
});
