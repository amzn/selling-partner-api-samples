import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NextIntlClientProvider } from "next-intl";
import SchemaValidatorButton from "@/app/components/schema-validator-button";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import userEvent from "@testing-library/user-event";
import translations from "@/app/internationalization/translations/en-US.json";
import { MOCK_SCHEMA } from "@/app/test-utils/mock-schema";
import { US_LOCALE } from "@/app/constants/global";

const VALIDATOR = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false,
  validateSchema: false,
});
addFormats(VALIDATOR);

const MOCK_DATA = {};

function renderSchemaValidatorButton() {
  render(
    <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
      <SchemaValidatorButton
        data={MOCK_DATA}
        schema={MOCK_SCHEMA}
        validator={VALIDATOR}
      />
    </NextIntlClientProvider>,
  );
}

describe("Test for the SchemaValidatorButton component", () => {
  test("verifies if the schema validation errors are shown in the dialog.", async () => {
    renderSchemaValidatorButton();

    const schemaValidatorButton = screen.getByTestId("schemaValidatorButton");
    await userEvent.click(schemaValidatorButton);
    await screen.findByTestId("fullScreenDialog");
    await screen.findByTestId("cancelFullScreenDialog");
    const cancelFullScreenDialog = screen.getByTestId("cancelFullScreenDialog");
    const fullScreenDialog = screen.getByTestId("fullScreenDialog");

    expect(fullScreenDialog).toMatchSnapshot();
    await userEvent.click(cancelFullScreenDialog);
    expect(fullScreenDialog).not.toBeVisible();

    await userEvent.click(schemaValidatorButton);
    await screen.findByTestId("fullScreenDialog");
    await userEvent.click(cancelFullScreenDialog);
    expect(fullScreenDialog).not.toBeVisible();
  });
});
