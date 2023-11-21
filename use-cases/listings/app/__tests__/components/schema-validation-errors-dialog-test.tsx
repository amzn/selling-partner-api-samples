import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NextIntlClientProvider } from "next-intl";
import SchemaValidationErrorsDialog from "@/app/components/schema-validation-errors-dialog";
import { ErrorObject } from "ajv";
import translations from "@/app/internationalization/translations/en-US.json";
import { US_LOCALE } from "@/app/constants/global";

const ERRORS: ErrorObject[] = [
  {
    keyword: "",
    schemaPath: "$schema",
    params: {
      key: "value",
    },
    message: "The value is invalid.",
    instancePath: "/item_name[0]/value",
    propertyName: "value",
  },
];

describe("Test for the SchemaValidationErrorsDialog component", () => {
  test("renders non-empty errors using a dialog.", async () => {
    render(
      <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
        <SchemaValidationErrorsDialog onClose={() => {}} errors={ERRORS} />
      </NextIntlClientProvider>,
    );

    await screen.findByTestId("fullScreenDialog");
    const errorDialog = screen.getByTestId("fullScreenDialog");
    expect(errorDialog).toMatchSnapshot();
  });

  test("renders success dialog on empty errors.", async () => {
    render(
      <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
        <SchemaValidationErrorsDialog onClose={() => {}} errors={[]} />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByTestId("cancelFullScreenDialog")).toBeNull();
    expect(screen.queryByTestId("fullScreenDialog")).toBeNull();
    await screen.findByTestId("alertDialog");
    expect(screen.getByTestId("alertDialog")).toMatchSnapshot();
  });
});
