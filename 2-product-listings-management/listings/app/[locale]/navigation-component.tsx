"use client";

import HomeIcon from "@mui/icons-material/Home";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import { blue } from "@mui/material/colors";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import { usePathname } from "next/navigation";
import { useTranslations } from "use-intl";
import React, { useContext } from "react";
import { SettingsContext } from "@/app/context/settings-context-provider";
import { useRouter } from "next/navigation";
import {
  Settings,
  areSettingsIncomplete,
  SELLING_PARTNER_TYPE_KEY_VENDOR_CODE,
} from "@/app/[locale]/settings/settings";
import { DebugContext } from "@/app/context/debug-context-provider";
import {
  BULK_LISTING_PAGE_ID,
  BULK_LISTING_PAGE_PATH,
  CREATE_LISTING_PAGE_ID,
  CREATE_LISTING_PAGE_PATH,
  CREATE_OFFER_PAGE_ID,
  CREATE_OFFER_PAGE_PATH,
  DELETE_LISTING_PAGE_ID,
  DELETE_LISTING_PAGE_PATH,
  NOTIFICATIONS_PAGE_ID,
  NOTIFICATIONS_PAGE_PATH,
  SETTINGS_PAGE_PATH,
  UPDATE_LISTING_PAGE_ID,
  UPDATE_LISTING_PAGE_PATH,
} from "@/app/constants/global";
import TooltipWrapper from "../components/tooltip-wrapper";

/**
 * Type which represents page disable information.
 */
interface DisabledResult {
  isDisabled: boolean;
  translation?: string;
}

/**
 * Type which represents a Page information.
 */
interface Page {
  id: string;
  href: string;
  disabledResult: DisabledResult;
}

/**
 * Navigation Component which helps the user navigate between various use cases that this app has to offer.
 */
export default function NavigationComponent() {
  const settingsContext = useContext(SettingsContext);
  const router = useRouter();

  const getCreateOfferDisabled = (settings: Settings) => {
    if (settings.sellingPartnerIdType == SELLING_PARTNER_TYPE_KEY_VENDOR_CODE) {
      return {
        isDisabled: true,
        translation: "vendorCodesCannotCreateOffers",
      };
    }
    return {
      isDisabled: false,
    };
  };

  const getDisabled = (pageId: string, settings: Settings) => {
    switch (pageId) {
      case CREATE_OFFER_PAGE_ID:
        return getCreateOfferDisabled(settings);
      default:
        return {
          isDisabled: false,
        };
    }
  };

  const pageInfo: Page[] = [
    {
      id: BULK_LISTING_PAGE_ID,
      href: BULK_LISTING_PAGE_PATH,
      disabledResult: getDisabled(
        BULK_LISTING_PAGE_ID,
        settingsContext.settingsState.settings,
      ),
    },
    {
      id: CREATE_LISTING_PAGE_ID,
      href: CREATE_LISTING_PAGE_PATH,
      disabledResult: getDisabled(
        CREATE_LISTING_PAGE_ID,
        settingsContext.settingsState.settings,
      ),
    },
    {
      id: CREATE_OFFER_PAGE_ID,
      href: CREATE_OFFER_PAGE_PATH,
      disabledResult: getDisabled(
        CREATE_OFFER_PAGE_ID,
        settingsContext.settingsState.settings,
      ),
    },
    {
      id: DELETE_LISTING_PAGE_ID,
      href: DELETE_LISTING_PAGE_PATH,
      disabledResult: getDisabled(
        DELETE_LISTING_PAGE_ID,
        settingsContext.settingsState.settings,
      ),
    },
    {
      id: NOTIFICATIONS_PAGE_ID,
      href: NOTIFICATIONS_PAGE_PATH,
      disabledResult: getDisabled(
        NOTIFICATIONS_PAGE_ID,
        settingsContext.settingsState.settings,
      ),
    },
    {
      id: UPDATE_LISTING_PAGE_ID,
      href: UPDATE_LISTING_PAGE_PATH,
      disabledResult: getDisabled(
        UPDATE_LISTING_PAGE_ID,
        settingsContext.settingsState.settings,
      ),
    },
  ];

  return (
    <AppBar position="static" sx={{ backgroundColor: "white" }}>
      <Container maxWidth={false}>
        <Toolbar disableGutters>
          <IconButton
            sx={{ p: 0, mr: 0.5 }}
            data-testid={"homeButton"}
            onClick={() => router.push("/")}
          >
            <Avatar sx={{ bgcolor: blue[500] }}>
              <HomeIcon />
            </Avatar>
          </IconButton>
          {pageInfo.map((page: Page) => (
            <Page key={page.id} page={page} />
          ))}
        </Toolbar>
      </Container>
    </AppBar>
  );
}

function Page({ page }: { page: Page }) {
  const settingsContext = useContext(SettingsContext);
  const debugContext = useContext(DebugContext);
  const router = useRouter();
  const translations = useTranslations("Navigation");
  const pathname = usePathname();
  const disabledResult = page.disabledResult;

  const getBackgroundColor = (href: string) =>
    pathname === href ? "#B30C00" : "#2196f3";

  const clearDebugContextAndRouteToDifferentPage = (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    if (areSettingsIncomplete(settingsContext.settingsState.settings)) {
      router.push(SETTINGS_PAGE_PATH);
    } else {
      debugContext.clearDebugContext(page.href);
      router.push(page.href);
    }
  };

  return (
    <TooltipWrapper
      title={
        disabledResult.isDisabled
          ? translations(disabledResult.translation)
          : translations(`${page.id}HelpText`)
      }
    >
      <Button
        data-testid={page.id}
        variant="contained"
        sx={{
          mx: 0.5,
          backgroundColor: getBackgroundColor(page.href),
          textTransform: "none",
        }}
        onClick={clearDebugContextAndRouteToDifferentPage}
        disabled={disabledResult.isDisabled}
      >
        {translations(page.id)}
      </Button>
    </TooltipWrapper>
  );
}
