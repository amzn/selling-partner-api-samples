import ReadOnlySurfaceContainer from "@/app/components/readonly-surface-container";
import { v4 as uuid } from "uuid";
import { useTranslations } from "use-intl";
import { FEED_DOCUMENTS_API_PATH } from "@/app/constants/global";
import { saveAs } from "file-saver";
import AlertDialog from "@/app/components/alert-dialog";
import { Feed } from "@/app/model/types";
import AlertComponent from "@/app/components/alert";
import { Box } from "@mui/material";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";

/**
 * A component which displays the details of the feeds.
 * @param feeds list of feeds to render.
 * @constructor
 */
export default function FeedsRenderer({ feeds }: { feeds: Feed[] }) {
  const translations = useTranslations("FeedContainer");
  const fetcherForActionButton = useCustomFetcher((fetcherKeys: string[]) => {
    const [url, resultFeedDocumentId] = fetcherKeys;
    return {
      headers: {
        feedDocumentId: resultFeedDocumentId,
      },
    };
  });

  const feedContainers = feeds.map((feed, index) => {
    const surfaceFieldProps = new Map<string, string>();
    surfaceFieldProps.set("id", feed.feedId);
    surfaceFieldProps.set("type", feed.feedType);
    surfaceFieldProps.set("createdTime", feed.createdTime);
    surfaceFieldProps.set("processingStatus", feed.processingStatus);

    const downloadResultFeedDocumentHandler = (
      data: any,
      onClose: () => void,
    ) => {
      saveAs(
        new Blob([data.content], {
          type: data.contentType,
        }),
        `ProcessingReport-${feed.feedId}`,
      );
      return (
        <AlertDialog
          key={uuid()}
          title={translations("successAlertTitle")}
          content={translations("successAlertContent")}
          onClose={onClose}
        />
      );
    };

    return (
      <ReadOnlySurfaceContainer
        key={feed.feedId}
        fieldProps={surfaceFieldProps}
        translationNamespace={"FeedContainer"}
        inputElementIdPrefix={`FeedContainer-${index}`}
        actionButtonProps={{
          isButtonDisabled: (feed?.resultFeedDocumentId?.length || 0) <= 0,
          buttonId: `downloadProcessingReport-${index}`,
          buttonName: translations("actionButtonName"),
          buttonHelpText: translations("actionButtonHelpText"),
          fetchKeys: [FEED_DOCUMENTS_API_PATH, feed.resultFeedDocumentId],
          fetcher: fetcherForActionButton,
          fetchedDataHandler: downloadResultFeedDocumentHandler,
          failureAlertTitle: translations("getFeedFailureAlertTitle"),
          failureAlertContent: translations("getFeedFailureAlertContent"),
        }}
      />
    );
  });

  return (
    <>
      {feeds?.length ? (
        feedContainers
      ) : (
        <Box marginTop={5}>
          <AlertComponent
            id={"no-feeds-alert"}
            state={true}
            stateHandler={() => {}}
            severity={"info"}
            message={translations("noFeedsFoundAlert")}
            staticAlert={true}
          />
        </Box>
      )}
    </>
  );
}
