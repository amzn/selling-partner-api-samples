import React from "react";
import { NextIntlClientProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ListingCreationFormComponent from "@/app/components/listing/listing-creation-form-component";
import { CREATE_LISTING_USE_CASE, US_LOCALE } from "@/app/constants/global";

function MockedListingAttributesEditorComponent() {
  return <div> Mocked ListingAttributesEditorComponent </div>;
}

jest.mock(
  "@/app/components/listing-attributes-editor-component",
  () => MockedListingAttributesEditorComponent,
);

describe("Test for the ListingCreationFormComponent", () => {
  test("Snapshot Test for listing creation form", async () => {
    const result = {
      title: "test1",
      asin: "asin1",
      productType: "productType1",
    };

    const { asFragment } = render(
      <NextIntlClientProvider messages={translations} locale={US_LOCALE}>
        <ListingCreationFormComponent
          chosenProductType={result.productType}
          useCase={CREATE_LISTING_USE_CASE}
        />
      </NextIntlClientProvider>,
    );

    expect(asFragment()).toMatchSnapshot();
    const byRole = screen.getByRole("textbox");
    await userEvent.type(byRole, "SKU");
    expect(asFragment()).toMatchSnapshot();
  });
});
