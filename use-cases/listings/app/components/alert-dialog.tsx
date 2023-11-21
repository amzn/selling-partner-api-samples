import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useTranslations } from "use-intl";
import { useState } from "react";

/**
 * Props for the confirmation behavior of the alert dialog.
 */
interface ConfirmationOptions {
  /**
   * true if the alert dialog has to show confirmation behavior.
   */
  showConfirmation: boolean;
  /**
   * The content of the confirmation button.
   */
  confirmationButtonContent: string;
  /**
   * The content of the confirmation cancel button.
   */
  confirmationCancelButtonContent: string;
  /**
   * A function which is executed when a user confirms the dialog.
   */
  onConfirm: () => void;
}

/**
 * A component which alerts the user using a backdrop based Dialog.
 * @param title title of the dialog.
 * @param content content to be shown inside the dialog.
 * @param onClose a function which is executed when a user closes the dialog
 * @param confirmationOptions describe whether & how to provide a confirmation option
 * @constructor
 */
export default function AlertDialog({
  title,
  content,
  onClose,
  confirmationOptions,
}: {
  title: string;
  content: string;
  onClose?: () => void;
  confirmationOptions?: ConfirmationOptions;
}) {
  const [open, setOpen] = useState(true);
  const translations = useTranslations("AlertDialog");
  const closeButtonTranslation = confirmationOptions?.showConfirmation
    ? confirmationOptions.confirmationCancelButtonContent
    : translations("close");

  const handleClose = () => {
    setOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const handleConfirm = () => {
    setOpen(false);
    confirmationOptions!.onConfirm();
  };

  return (
    <div>
      <Dialog data-testid="alertDialog" open={open} onClose={handleClose}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{content}</DialogContentText>
        </DialogContent>
        <DialogActions>
          {confirmationOptions?.showConfirmation && (
            <Button data-testid="confirmAlertDialog" onClick={handleConfirm}>
              {confirmationOptions.confirmationButtonContent}
            </Button>
          )}
          <Button
            data-testid="cancelAlertDialog"
            onClick={handleClose}
            autoFocus
          >
            {closeButtonTranslation}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
