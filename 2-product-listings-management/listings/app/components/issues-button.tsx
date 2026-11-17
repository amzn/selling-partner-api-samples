import IssuesDialog from "@/app/components/issues-dialog";
import { useTranslations } from "use-intl";
import { useState } from "react";
import { Issue } from "@/app/model/types";
import FormInputButtonComponent from "@/app/components/form-input-button";
import { ButtonProps } from "@mui/material/Button/Button";

/**
 * A button when clicked displays the issues in a full screen dialog.
 * @param issues issues to render.
 * @constructor
 */
export default function IssuesButton({ issues }: { issues: Issue[] }) {
  const translations = useTranslations("IssuesButton");
  const [showIssuesDialog, setShowIssuesDialog] = useState(false);
  const issuesButtonProps: ButtonProps = {
    variant: "contained",
    sx: {
      paddingTop: "5px",
    },
    onClick: () => {
      setShowIssuesDialog(true);
    },
  };

  return (
    <>
      <FormInputButtonComponent
        id={"issuesButton"}
        name={translations("buttonName")}
        label={translations("buttonLabel")}
        helpText={translations("buttonHelpText")}
        buttonProps={issuesButtonProps}
      />

      {showIssuesDialog && (
        <IssuesDialog
          issues={issues}
          dialogTitle={translations("issuesDialogTitle")}
          onClose={() => setShowIssuesDialog(false)}
          closeButtonHelpText={translations("closeButtonHelpText")}
        />
      )}
    </>
  );
}
