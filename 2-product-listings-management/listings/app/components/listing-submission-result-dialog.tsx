import AlertDialog from "@/app/components/alert-dialog";
import { useTranslations } from "use-intl";
import { v4 as uuid } from "uuid";
import { ListingSubmissionResult } from "@/app/model/types";
import IssuesDialog from "@/app/components/issues-dialog";

/**
 * A composite Dialog which handles a listing submission response.
 * If the response has no issues, then it shows a successful alert to the user.
 * If the response has issues, then it shows the issues in a full screen dialog
 * to the user.
 * @param dialogID Identifier of the dialog.
 * @param result the listing submission response.
 * @param onClose function which is called when the dialog is closed.
 * @constructor
 */
export default function ListingSubmissionResultDialog({
  dialogID,
  result,
  onClose,
}: {
  dialogID: string;
  result: ListingSubmissionResult;
  onClose: () => void;
}) {
  const translations = useTranslations(dialogID);

  if (!result.issues?.length) {
    return (
      <AlertDialog
        key={uuid()}
        title={translations("successStatus")}
        content={translations("successMessage", {
          submissionId: result.submissionId,
          status: result.status,
        })}
        onClose={onClose}
      />
    );
  }

  return (
    <IssuesDialog
      issues={result.issues}
      dialogTitle={translations("successMessageWithIssues", {
        submissionId: result.submissionId,
        status: result.status,
      })}
      onClose={onClose}
      closeButtonHelpText={translations("closeButtonHelpText")}
    />
  );
}
