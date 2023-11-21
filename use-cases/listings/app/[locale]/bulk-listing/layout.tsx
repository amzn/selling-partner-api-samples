"use client";
import React from "react";
import DualPageLayout from "@/app/components/dual-page-layout";

/**
 * Parallel Route layout for the Bulk Listing.
 * @param props input props.
 * @constructor
 */
export default function Layout(props: {
  uploadFeeds: React.ReactNode;
  pastFeeds: React.ReactNode;
}) {
  return (
    <DualPageLayout
      leftContent={props.uploadFeeds}
      rightContent={props.pastFeeds}
    />
  );
}
