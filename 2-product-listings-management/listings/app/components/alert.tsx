import { Collapse, IconButton, Alert } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import React from "react";

/**
 * id: HTML id for the component
 * state: visibility state for the alert
 * stateHandler: function which controls the visibility of the component
 * severity: Display severity for the alert. Only supports 4 severities of Material UI Alert
 * message: Message to be displayed in the alert box
 * staticAlert: Hides the close button if set to true
 */
interface InputProps {
  id: string;
  state: boolean;
  stateHandler: any;
  severity: "error" | "warning" | "info" | "success";
  message: string;
  staticAlert?: boolean;
}

/**
 * Component to display temporary messages to user.
 * @param props
 */
export default function AlertComponent(props: InputProps) {
  return (
    <Collapse in={props.state}>
      <Alert
        data-testid={props.id}
        severity={props.severity}
        action={
          !props.staticAlert && (
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => {
                props.stateHandler(false);
              }}
            >
              <CloseIcon />
            </IconButton>
          )
        }
        sx={{ marginBottom: 2 }}
      >
        {props.message}
      </Alert>
    </Collapse>
  );
}
