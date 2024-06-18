"use client";
import React, { createContext, useState } from "react";
import AlertComponent from "@/app/components/alert";
import Container from "@mui/material/Container";

/**
 * The Alert state.
 */
export interface AlertState {
  content: string;
  isAlert: boolean;
  alertId: string;
}

/**
 * The state which is provided by the alert provider.
 */
export interface SettableAlertState {
  alertState: AlertState;
  setAlertState: (alertState: AlertState) => void;
}

const initialAlertState: AlertState = {
  content: "",
  isAlert: false,
  alertId: "",
};

/**
 * The React context for the alert.
 */
export const AlertContext = createContext<SettableAlertState>({
  alertState: initialAlertState,
  setAlertState: (alertState: AlertState) => {},
});

/**
 * Wraps the child elements with the React Content Provider for the Alert.
 * @param children the child elements.
 * @constructor
 */
export default function AlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [alertState, setAlertState] = useState<AlertState>(initialAlertState);

  function setClose() {
    setAlertState({ ...alertState, isAlert: false });
  }

  return (
    <AlertContext.Provider value={{ alertState, setAlertState }}>
      <Container maxWidth="md">
        {alertState.isAlert && (
          <AlertComponent
            id={alertState.alertId}
            data-testid={alertState.alertId}
            state={alertState.isAlert}
            stateHandler={setClose}
            severity={"info"}
            message={alertState.content}
            staticAlert={false}
          />
        )}
      </Container>
      {children}
    </AlertContext.Provider>
  );
}
