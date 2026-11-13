"use client";

import { Box, Grid, IconButton, Tooltip } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import InfoIcon from "@mui/icons-material/Info";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_PAGE_PATH } from "@/app/constants/global";
import { useTranslations } from "use-intl";

/**
 * Displays icons which when clicked takes the user to a page.
 */
export default function QuickLinksComponent() {
  const pathname = usePathname();
  const translations = useTranslations("QuickLinks");
  return (
    <Grid container justifyContent={"right"}>
      <Box sx={isInfoHidden(pathname)}>
        <Tooltip title={translations("infoToolTip")}>
          <NextLink href={getInfoPath(pathname)} passHref>
            <IconButton aria-label="settings">
              <InfoIcon />
            </IconButton>
          </NextLink>
        </Tooltip>
      </Box>
      <Box sx={isSettingsHidden(pathname)}>
        <Tooltip title={translations("settingsToolTip")}>
          <NextLink href={SETTINGS_PAGE_PATH} passHref>
            <IconButton aria-label="settings">
              <SettingsIcon />
            </IconButton>
          </NextLink>
        </Tooltip>
      </Box>
    </Grid>
  );
}

function isSettingsHidden(pathname: string) {
  if (pathname === SETTINGS_PAGE_PATH) {
    return { display: "none" };
  } else {
    return {};
  }
}

function getInfoPath(pathname: string) {
  return `/${pathname.replace("/", "#")}`;
}

function isInfoHidden(pathname: string) {
  if (pathname === "/") {
    return { display: "none" };
  } else {
    return {};
  }
}
