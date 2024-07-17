import Layout from "@/app/[locale]/bulk-listing/layout";
import { render } from "@testing-library/react";
import { IntlProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import React from "react";
import { US_LOCALE } from "@/app/constants/global";

const uploadFeedsText = "This is the upload feeds page";
const pastFeedsText = "This is the past feeds page";

const simpleUploadFeeds = <>{uploadFeedsText}</>;
const simplePastFeeds = <>{pastFeedsText}</>;

function renderBulkListingLayout() {
  const { asFragment, queryByText, getByText, queryByTestId } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <Layout uploadFeeds={simpleUploadFeeds} pastFeeds={simplePastFeeds} />
    </IntlProvider>,
  );

  return { asFragment, queryByText, getByText };
}

describe("Test for the Bulk Listing Layout", () => {
  test("Upload Feeds is present", async () => {
    const { queryByText } = renderBulkListingLayout();
    const uploadFeedsPage = queryByText(uploadFeedsText);
    expect(uploadFeedsPage).toBeTruthy();
  });

  test("Past Feeds is present", async () => {
    const { queryByText } = renderBulkListingLayout();
    const pastFeedsPage = queryByText(pastFeedsText);
    expect(pastFeedsPage).toBeTruthy();
  });

  test("Snapshot Test", async () => {
    const { asFragment } = renderBulkListingLayout();
    expect(asFragment()).toMatchSnapshot();
  });
});
