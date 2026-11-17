"use client";
import React from "react";
import DualPageLayout from "@/app/components/dual-page-layout";

/**
 * Parallel Route layout for the Notifications.
 * @param props input props.
 * @constructor
 */
export default function Layout(props: {
  createSubscription: React.ReactNode;
  viewSubscriptions: React.ReactNode;
}) {
  return (
    <DualPageLayout
      leftContent={props.createSubscription}
      rightContent={props.viewSubscriptions}
    />
  );
}
