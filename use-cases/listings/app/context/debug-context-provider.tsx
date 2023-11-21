"use client";
import { SPAPIRequestResponse } from "@/app/model/types";
import React, { createContext, useState } from "react";

/**
 * The debug state associated with the routes.
 */
export interface DebugState {
  routeContext: Map<string, SPAPIRequestResponse[]>;
}

/**
 * Allows the routes to update the debug state associated with the routes.
 */
export interface SettableDebugState {
  debugState: DebugState;
  addRequestResponse: (
    route: string,
    requestResponse: SPAPIRequestResponse,
  ) => void;
  clearDebugContext: (route: string) => void;
  getRequestResponses: (route: string) => SPAPIRequestResponse[];
}

/**
 * The React Context which is provided to the JSX elements.
 */
export const DebugContext = createContext<SettableDebugState>({
  debugState: {
    routeContext: new Map<string, SPAPIRequestResponse[]>(),
  },
  addRequestResponse: (
    route: string,
    requestResponse: SPAPIRequestResponse,
  ) => {},
  clearDebugContext: (route: string) => {},
  getRequestResponses: (route: string) => [],
});

/**
 * A React component which wraps the given child elements with the DebugContext.
 * @param children the react elements.
 * @param initialDebugState the initial debug context state.
 * @constructor
 */
export default function DebuggingContextProvider({
  children,
  initialDebugState,
}: {
  children: React.ReactNode;
  initialDebugState?: DebugState;
}) {
  const [debugState, setDebugState] = useState<DebugState>(
    initialDebugState ?? {
      routeContext: new Map<string, SPAPIRequestResponse[]>(),
    },
  );

  const debugContext: SettableDebugState = {
    debugState: debugState,
    addRequestResponse: (route, requestResponse) => {
      const existingReqResponses = debugState.routeContext.get(route) ?? [];
      existingReqResponses.unshift(requestResponse);
      debugState.routeContext.set(route, existingReqResponses);
    },
    clearDebugContext: (route) => {
      if (debugState.routeContext.get(route)?.length) {
        debugState.routeContext.set(route, []);
      }
    },
    getRequestResponses: (route: string) => {
      const existingReqResponses = debugState.routeContext.get(route) ?? [];
      debugState.routeContext.set(route, existingReqResponses);
      return existingReqResponses;
    },
  };

  return (
    <DebugContext.Provider value={debugContext}>
      {children}
    </DebugContext.Provider>
  );
}
