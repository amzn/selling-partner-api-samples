import SaveActionButton from "@/app/components/save-action-button";
import { useTranslations } from "use-intl";
import { LISTINGS_ITEM_API_PATH } from "@/app/constants/global";
import ListingSubmissionResultDialog from "@/app/components/listing-submission-result-dialog";
import { v4 as uuid } from "uuid";
import { useLocale } from "next-intl";
import { serializeToJsonString } from "@/app/utils/serialization";
import { convertLocaleToSPAPIFormat } from "@/app/utils/i18n";
import { cloneAndCleanupListing } from "@/app/utils/schema";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";

/**
 * A submit button which is used to submit the listing to the Amazon through
 * the Listings Items API.
 * @param sku the sku.
 * @param productType the product type.
 * @param useCase the user case where this component is used in the app.
 * @param listing the listing data which is submitted to Amazon.
 * @param submissionMode the submission mode to be used when the use case is update listing.
 * @constructor
 */
export default function ListingSubmitButton({
  sku,
  productType,
  useCase,
  currentListing,
  initialListing,
  submissionMode,
}: {
  sku: string;
  productType: string;
  useCase: string;
  currentListing: any;
  initialListing: any;
  submissionMode?: string;
}) {
  const translations = useTranslations("ListingSubmitButton");
  const locale = useLocale();
  const putListingsItemFetcher = useCustomFetcher((fetcherKeys: string[]) => {
    const [
      url,
      sku,
      locale,
      productType,
      useCase,
      submissionMode,
      currentListing,
      initialListing,
    ] = fetcherKeys;
    return {
      method: "POST",
      headers: {
        sku: sku,
        locale: locale,
        productType: productType,
        useCase: useCase,
        submissionMode: submissionMode,
      },
      body: serializeToJsonString({
        currentListing: currentListing,
        initialListing: initialListing,
      }),
    };
  });

  const showListingSubmissionResponse = (data: any, onClose: () => void) => {
    return (
      <ListingSubmissionResultDialog
        key={uuid()}
        result={data}
        onClose={onClose}
      />
    );
  };

  return (
    <SaveActionButton
      buttonName={translations("buttonName")}
      buttonHelpText={translations("buttonHelpText")}
      buttonId="listingSubmitButton"
      isButtonDisabled={false}
      fetchKeys={[
        LISTINGS_ITEM_API_PATH,
        sku,
        convertLocaleToSPAPIFormat(locale),
        productType,
        useCase,
        submissionMode,
        cloneAndCleanupListing(currentListing),
        initialListing,
      ]}
      fetcher={putListingsItemFetcher}
      failureAlertTitle={translations("failureAlertTitle")}
      failureAlertContent={translations("failureAlertContent")}
      fetchedDataHandler={showListingSubmissionResponse}
    />
  );
}
