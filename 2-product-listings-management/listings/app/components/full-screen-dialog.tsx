import { AppBar, Button, Tooltip, Typography } from "@mui/material";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import DialogContent from "@mui/material/DialogContent";
import Dialog from "@mui/material/Dialog";
import React, { ReactNode } from "react";
import TooltipWrapper from "./tooltip-wrapper";

/**
 * A dialog which occupies full screen.
 * The dialog has a close button and title at the top of the screen. The body
 * of the dialog can be any arbitrary JSX elements.
 * @param isOpen flag to indicate whether the dialog is open or closed.
 * @param onClose a function which is executed when the dialog is closed.
 * @param title the title of the dialog which is shown at the top of screen.
 * @param closeButtonHelpText the help text for the close button in the dialog.
 * @param actionButonName name of the action button which is added to the right
 * side of the dialog title.
 * @param actionButtonHelpText help text for the action button.
 * @param actionButtonClickHandler handler which is invoked when the action button is invoked.
 * @param children the content which is shown inside the dialog.
 * @constructor
 */
export default function FullScreenDialog({
  isOpen,
  onClose,
  title,
  closeButtonHelpText,
  actionButtonName,
  actionButtonHelpText,
  actionButtonClickHandler,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  closeButtonHelpText: string;
  actionButtonName?: string;
  actionButtonHelpText?: string;
  actionButtonClickHandler?: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      fullScreen
      data-testid="fullScreenDialog"
      open={isOpen}
      onClose={onClose}
      scroll={"paper"}
    >
      <AppBar sx={{ position: "relative" }}>
        <Toolbar>
          <Tooltip title={closeButtonHelpText} placement={"top"}>
            <IconButton
              data-testid="cancelFullScreenDialog"
              edge="start"
              color="inherit"
              onClick={onClose}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>

          <Typography
            sx={{ ml: 2, flex: 1, alignContent: "center" }}
            variant="h6"
            component="div"
          >
            {title}
          </Typography>

          {actionButtonName && (
            <TooltipWrapper title={actionButtonHelpText} placement={"right"}>
              <Button
                data-testid={"actionButton"}
                color="inherit"
                onClick={actionButtonClickHandler}
              >
                {actionButtonName}
              </Button>
            </TooltipWrapper>
          )}
        </Toolbar>
      </AppBar>
      <DialogContent dividers={true}>{children}</DialogContent>
    </Dialog>
  );
}
