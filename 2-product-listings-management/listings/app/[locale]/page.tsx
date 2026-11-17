"use client";

import { Box, Container, Typography } from "@mui/material";
import TitleComponent from "@/app/components/title";
import NextLink from "next/link";
import { SETTINGS_PAGE_PATH } from "@/app/constants/global";
import {
  BULK_LISTING_PAGE_PATH,
  CREATE_LISTING_PAGE_PATH,
  CREATE_OFFER_PAGE_PATH,
  DELETE_LISTING_PAGE_PATH,
  NOTIFICATIONS_PAGE_PATH,
  UPDATE_LISTING_PAGE_PATH,
} from "@/app/constants/global";
import { useTranslations } from "use-intl";

const DEBUG_CONSOLE = "debug-console";
const ATTRIBUTES_EDITOR = "attributes-editor";

/**
 * This is the home page for the app.
 */
export default function Home() {
  return (
    <Container>
      <Intro />
      <HowToNavigate />
      <HowToConfigureSettings />
      <HowToDebugConsole />
      <BulkListing />
      <CreateListing />
      <CreateOffer />
      <DeleteListing />
      <Notifications />
      <UpdateListing />
      <AttributesEditor />
    </Container>
  );
}

function Intro() {
  const translations = useTranslations("Home.Intro");

  return (
    <Section
      id={"intro"}
      title={translations("title")}
      content={
        <>
          {translations("content1")}
          <NextLink href={translations("workflowGuideURL")}>
            {translations("workflowGuideText")}
          </NextLink>
          {translations("content2")}
        </>
      }
    />
  );
}

function HowToNavigate() {
  const translations = useTranslations("Home.Navigate");

  return (
    <Section
      id={"navigate"}
      title={translations("title")}
      content={translations("content")}
    />
  );
}

function HowToConfigureSettings() {
  const translations = useTranslations("Home.Settings");

  return (
    <Section
      id={getIdFromPath(SETTINGS_PAGE_PATH)}
      title={translations("title")}
      content={translations("content")}
    />
  );
}

function HowToDebugConsole() {
  const translations = useTranslations("Home.DebugConsole");

  return (
    <Section
      id={DEBUG_CONSOLE}
      title={translations("title")}
      content={translations("content")}
    />
  );
}

function BulkListing() {
  const commonTranslations = useTranslations("Home.Common");
  const useCaseTranslations = useTranslations("Navigation");
  const sectionTranslations = useTranslations("Home.BulkListing");
  return (
    <Section
      id={getIdFromPath(BULK_LISTING_PAGE_PATH)}
      title={sectionTranslations("title")}
      content={
        <>
          {sectionTranslations("content")}
          <NextLink href={sectionTranslations("workflowGuideURL")}>
            {sectionTranslations("workflowGuideText")}
          </NextLink>
          {commonTranslations("moreInfo", {
            useCase: useCaseTranslations("bulkListing"),
          })}
          {commonTranslations("debugConsoleText")}
          <NextLink href={`#${DEBUG_CONSOLE}`}>
            {commonTranslations("debugConsoleShortTitle")}
          </NextLink>
          {`.`}
        </>
      }
    />
  );
}

function CreateListing() {
  const commonTranslations = useTranslations("Home.Common");
  const useCaseTranslations = useTranslations("Navigation");
  const sectionTranslations = useTranslations("Home.CreateListing");
  return (
    <Section
      id={getIdFromPath(CREATE_LISTING_PAGE_PATH)}
      title={sectionTranslations("title")}
      content={
        <>
          {sectionTranslations("content")}
          <NextLink href={`#${ATTRIBUTES_EDITOR}`}>
            {commonTranslations("attributesEditorForm")}
          </NextLink>
          {commonTranslations("submissionInfo")}
          <NextLink href={sectionTranslations("workflowGuideURL")}>
            {commonTranslations("listingManagementWorkflowGuide")}
          </NextLink>
          {commonTranslations("moreInfo", {
            useCase: useCaseTranslations("createListing"),
          })}
          {commonTranslations("debugConsoleText")}
          <NextLink href={`#${DEBUG_CONSOLE}`}>
            {commonTranslations("debugConsoleShortTitle")}
          </NextLink>
          {`.`}
        </>
      }
    />
  );
}

function CreateOffer() {
  const commonTranslations = useTranslations("Home.Common");
  const useCaseTranslations = useTranslations("Navigation");
  const sectionTranslations = useTranslations("Home.CreateOffer");
  return (
    <Section
      id={getIdFromPath(CREATE_OFFER_PAGE_PATH)}
      title={sectionTranslations("title")}
      content={
        <>
          {sectionTranslations("content")}
          <NextLink href={`#${ATTRIBUTES_EDITOR}`}>
            {commonTranslations("attributesEditorForm")}
          </NextLink>
          {commonTranslations("submissionInfo")}
          <NextLink href={sectionTranslations("workflowGuideURL")}>
            {commonTranslations("listingManagementWorkflowGuide")}
          </NextLink>

          {commonTranslations("moreInfo", {
            useCase: useCaseTranslations("createOffer"),
          })}
          {commonTranslations("debugConsoleText")}
          <NextLink href={`#${DEBUG_CONSOLE}`}>
            {commonTranslations("debugConsoleShortTitle")}
          </NextLink>
          {`.`}
        </>
      }
    />
  );
}

function DeleteListing() {
  const commonTranslations = useTranslations("Home.Common");
  const useCaseTranslations = useTranslations("Navigation");
  const sectionTranslations = useTranslations("Home.DeleteListing");
  return (
    <Section
      id={getIdFromPath(DELETE_LISTING_PAGE_PATH)}
      title={sectionTranslations("title")}
      content={
        <>
          {sectionTranslations("content")}
          <NextLink href={sectionTranslations("workflowGuideURL")}>
            {commonTranslations("listingManagementWorkflowGuide")}
          </NextLink>
          {commonTranslations("moreInfo", {
            useCase: useCaseTranslations("deleteListing"),
          })}
          {commonTranslations("debugConsoleText")}
          <NextLink href={`#${DEBUG_CONSOLE}`}>
            {commonTranslations("debugConsoleShortTitle")}
          </NextLink>
          {`.`}
        </>
      }
    />
  );
}

function Notifications() {
  const commonTranslations = useTranslations("Home.Common");
  const useCaseTranslations = useTranslations("Navigation");
  const sectionTranslations = useTranslations("Home.Notifications");
  return (
    <Section
      id={getIdFromPath(NOTIFICATIONS_PAGE_PATH)}
      title={sectionTranslations("title")}
      content={
        <>
          {sectionTranslations("content")}
          <NextLink href={sectionTranslations("workflowGuideURL")}>
            {sectionTranslations("eventBridgeWorkflowGuide")}
          </NextLink>
          {commonTranslations("moreInfo", {
            useCase: useCaseTranslations("notifications"),
          })}
          {commonTranslations("debugConsoleText")}
          <NextLink href={`#${DEBUG_CONSOLE}`}>
            {commonTranslations("debugConsoleShortTitle")}
          </NextLink>
          {`.`}
        </>
      }
    />
  );
}

function UpdateListing() {
  const commonTranslations = useTranslations("Home.Common");
  const useCaseTranslations = useTranslations("Navigation");
  const sectionTranslations = useTranslations("Home.UpdateListing");
  return (
    <Section
      id={getIdFromPath(UPDATE_LISTING_PAGE_PATH)}
      title={sectionTranslations("title")}
      content={
        <>
          {sectionTranslations("content")}
          <NextLink href={`#${ATTRIBUTES_EDITOR}`}>
            {commonTranslations("attributesEditorForm")}
          </NextLink>
          {sectionTranslations("content2")}
          <NextLink href={sectionTranslations("workflowGuideURL")}>
            {commonTranslations("listingManagementWorkflowGuide")}
          </NextLink>
          {commonTranslations("moreInfo", {
            useCase: useCaseTranslations("updateListing"),
          })}
          {commonTranslations("debugConsoleText")}
          <NextLink href={`#${DEBUG_CONSOLE}`}>
            {commonTranslations("debugConsoleShortTitle")}
          </NextLink>
          {`.`}
        </>
      }
    />
  );
}

function AttributesEditor() {
  const sectionTranslations = useTranslations("Home.AttributesEditor");

  return (
    <Section
      id={ATTRIBUTES_EDITOR}
      title={sectionTranslations("title")}
      content={sectionTranslations("content")}
    />
  );
}

interface SectionProps {
  title: string;
  content: any;
  id: string;
}

function Section(props: SectionProps) {
  return (
    <Box id={props.id}>
      <TitleComponent title={props.title} variant={"h4"} />
      <Typography paragraph={true} gutterBottom={true}>
        {props.content}
      </Typography>
    </Box>
  );
}

function getIdFromPath(path: string) {
  return path.replace("/", "");
}
