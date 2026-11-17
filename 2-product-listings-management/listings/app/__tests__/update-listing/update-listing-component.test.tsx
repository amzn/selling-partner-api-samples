import { render } from "@testing-library/react";
import ListingUpdateComponent from "@/app/[locale]/update-listing/listing-update-component";
import { MOCK_ISSUE } from "@/app/test-utils/mock-issue";
import translations from "@/app/internationalization/translations/en-US.json";
import { NextIntlProvider } from "next-intl";
import userEvent from "@testing-library/user-event";
import { US_LOCALE } from "@/app/constants/global";

jest.mock(
  "@/app/components/listing-attributes-editor-component",
  () =>
    function mockedListingAttributesEditorComponent() {
      return <div> Mocked ListingAttributesEditorComponent </div>;
    },
);

jest.mock(
  "@/app/components/issues-button",
  () =>
    function mockedIssueButton() {
      return <div> Mocked IssueButton </div>;
    },
);

jest.mock(
  "@/app/components/alert",
  () =>
    function mockedIssueButton() {
      return <div> Mocked Alert </div>;
    },
);

const SKU = "TestSKU";
const PRODUCT_TYPE = "SHIRT";

function renderListingUpdateComponent(listing: any) {
  return render(
    <NextIntlProvider locale={US_LOCALE} messages={translations}>
      <ListingUpdateComponent sku={SKU} currentListing={listing} />
    </NextIntlProvider>,
  );
}

describe("Test for the ListingUpdateComponent", () => {
  test("renders the issues button with put listings item write operation", () => {
    const { asFragment } = renderListingUpdateComponent({
      issues: [MOCK_ISSUE],
      attributes: {},
      productType: PRODUCT_TYPE,
    });
    expect(asFragment()).toMatchSnapshot();
  });

  test("doesn't render the issues button with patch listings item write operation", async () => {
    const { asFragment, getByRole, getAllByRole } =
      renderListingUpdateComponent({
        issues: [],
        attributes: {},
        productType: PRODUCT_TYPE,
      });

    await userEvent.click(getByRole("button", { name: /Put/i }));

    const optionComponentList = getAllByRole("option");
    const targetOptionComponent = optionComponentList[1];

    await userEvent.click(targetOptionComponent);

    expect(asFragment()).toMatchSnapshot();
  });

  test("renders alert with no PT", () => {
    const { asFragment } = renderListingUpdateComponent({
      issues: [],
      attributes: {},
    });

    expect(asFragment()).toMatchSnapshot();
  });

  test("renders alert with no SKU info", () => {
    const { asFragment } = renderListingUpdateComponent({});
    expect(asFragment()).toMatchSnapshot();
  });
});
