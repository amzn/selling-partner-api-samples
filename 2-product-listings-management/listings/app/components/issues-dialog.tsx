import { Issue } from "@/app/model/types";
import { serializeToJsonString } from "@/app/utils/serialization";
import ReadOnlySurfaceContainer from "@/app/components/readonly-surface-container";
import { v4 as uuid } from "uuid";
import FullScreenDialog from "@/app/components/full-screen-dialog";

/**
 * Reusable component to render the issues.
 * @param issues the list of issues to render.
 * @param dialogTitle title of the full screen dialog.
 * @param closeButtonHelpText help text for the close button displayed
 * in the dialog.
 * @param onClose function which is called when the dialog is closed.
 * @constructor
 */
export default function IssuesDialog({
  issues,
  dialogTitle,
  closeButtonHelpText,
  onClose,
}: {
  issues: Issue[];
  dialogTitle: string;
  closeButtonHelpText: string;
  onClose: () => void;
}) {
  const issueContainers = issues.map((issue, index) => {
    const surfaceFieldProps = new Map<string, string>();
    surfaceFieldProps.set("code", issue.code);
    surfaceFieldProps.set("message", issue.message);
    surfaceFieldProps.set("severity", issue.severity);
    if (issue.attributeNames) {
      surfaceFieldProps.set(
        "attributeNames",
        serializeToJsonString(issue.attributeNames),
      );
    }

    return (
      <ReadOnlySurfaceContainer
        key={uuid()}
        fieldProps={surfaceFieldProps}
        translationNamespace={"IssueContainer"}
        inputElementIdPrefix={`IssueContainer-${index}`}
      />
    );
  });

  return (
    <FullScreenDialog
      isOpen={true}
      onClose={onClose}
      title={dialogTitle}
      closeButtonHelpText={closeButtonHelpText}
    >
      {issueContainers}
    </FullScreenDialog>
  );
}
