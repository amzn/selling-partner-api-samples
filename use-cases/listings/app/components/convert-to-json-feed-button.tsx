import { Button } from "@mui/material";
import { useTranslations } from "use-intl";
import { cloneAndCleanupListing } from "@/app/utils/schema";
import { useContext, useState } from "react";
import { convertListingToJsonFeed } from "@/app/utils/json-feed";
import { useLocale } from "next-intl";
import { convertLocaleToSPAPIFormat } from "@/app/utils/i18n";
import { saveAs } from "file-saver";
import { serializeToJsonString } from "@/app/utils/serialization";
import AlertDialog from "@/app/components/alert-dialog";
import { SettingsContext } from "@/app/context/settings-context-provider";
import { v4 as uuid } from "uuid";
import { AlertDialogState } from "@/app/model/types";
import TooltipWrapper from "./tooltip-wrapper";

const SAVE_FILE_NAME = "JsonFeed.json";

/**
 * A button which converts the listing data entered by the user into
 * JSON_LISTINGS_FEED and saves the feed content into a file.
 * @param sku the sku of the listing.
 * @param productType the product type of the listing.
 * @param listing the listing data entered by the user.
 * @param useCase the type of the update for the listing.
 * @param initialListing the listing data before user edits.
 * @param writeOperation the write operation to be used when the use case is update listing.
 * @constructor
 */
export default function ConvertToJsonFeed({
  sku,
  productType,
  listing,
  useCase,
  initialListing,
  writeOperation,
}: {
  sku: string;
  productType: string;
  listing: object;
  useCase: string;
  initialListing: object;
  writeOperation?: string;
}) {
  const [alertDialogState, setAlertDialogState] = useState<AlertDialogState>({
    showAlert: false,
    alertTitle: "",
    alertContent: "",
  });
  const translations = useTranslations("ConvertToJsonFeed");
  const settingsContext = useContext(SettingsContext);
  const locale = useLocale();

  const transformToJsonFeedAndDownload = () => {
    const feed = convertListingToJsonFeed(
      sku,
      productType,
      cloneAndCleanupListing(listing),
      useCase,
      initialListing,
      settingsContext.settingsState.settings.sellingPartnerId,
      convertLocaleToSPAPIFormat(locale),
      writeOperation,
    );
    if (!feed) {
      setAlertDialogState({
        showAlert: true,
        alertTitle: translations("invalidStatus"),
        alertContent: translations("invalidMessage"),
      });
      return;
    }
    const feedBlob = new Blob([serializeToJsonString(feed)], {
      type: "text/plain;charset=utf-8",
    });
    saveAs(feedBlob, SAVE_FILE_NAME);
    setAlertDialogState({
      showAlert: true,
      alertTitle: translations("successStatus"),
      alertContent: translations("successMessage", {
        fileName: SAVE_FILE_NAME,
      }),
    });
  };

  const hideAlert = () =>
    setAlertDialogState({ ...alertDialogState, showAlert: false });

  return (
    <>
      <TooltipWrapper
        title={translations("buttonHelpText")}
        placement={"right"}
      >
        <Button
          id="convertToJsonFeed"
          data-testid="convertToJsonFeed"
          variant="contained"
          onClick={transformToJsonFeedAndDownload}
        >
          {translations("buttonName")}
        </Button>
      </TooltipWrapper>
      {alertDialogState.showAlert && (
        <AlertDialog
          key={uuid()}
          title={alertDialogState.alertTitle}
          content={alertDialogState.alertContent}
          onClose={hideAlert}
        />
      )}
    </>
  );
}
