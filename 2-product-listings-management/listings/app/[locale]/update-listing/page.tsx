"use client";
import ListingUpdateComponent from "@/app/[locale]/update-listing/listing-update-component";
import FormInputComponent from "@/app/components/form-input-component";
import React, { useState } from "react";
import SaveActionButton from "@/app/components/save-action-button";
import {
  LISTINGS_ITEM_API_PATH,
  SWR_CONFIG_DEFAULT_VALUE,
} from "@/app/constants/global";
import { SWRConfig } from "swr";
import { Container, Grid } from "@mui/material";
import TitleComponent from "@/app/components/title";
import { Listing } from "@/app/model/types";
import { convertLocaleToSPAPIFormat } from "@/app/utils/i18n";
import { useLocale } from "next-intl";
import { useTranslations } from "use-intl";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import { useStateForTextField } from "@/app/hooks/useStateForTextField";

export default function UpdateListing() {
  const locale = useLocale();
  const translations = useTranslations("UpdateListing");

  const [sku, handleSkuChange] = useStateForTextField("");

  const [currentListing, setListing] = useState<Listing>();

  const fetcherForActionButton = useCustomFetcher((fetcherKeys: string[]) => {
    const [url, sku, locale] = fetcherKeys;
    return {
      headers: {
        sku: sku,
        locale: convertLocaleToSPAPIFormat(locale),
      },
    };
  });

  const loadListingIntoReactState = (data: any, onClose: () => void) => {
    onClose();
    setListing(data as Listing);
    return <></>;
  };

  return (
    <SWRConfig value={SWR_CONFIG_DEFAULT_VALUE}>
      <Container maxWidth={"md"}>
        <Grid item>
          <TitleComponent title={translations("title")} />
          <FormInputComponent
            id={"sku"}
            required={true}
            label={translations("skuLabel")}
            helpText={translations("skuHelpText")}
            onChange={handleSkuChange}
          />
          <SaveActionButton
            buttonName={translations("retrieveSKUButtonLabel")}
            buttonHelpText={translations("retrieveSKUButtonHelpText")}
            buttonId={"retrieve-sku"}
            fetchKeys={[LISTINGS_ITEM_API_PATH, sku, locale]}
            fetcher={fetcherForActionButton}
            failureAlertTitle={translations("retrieveSKUFailureAlertTitle")}
            failureAlertContent={translations("retrieveSKUFailureAlertContent")}
            fetchedDataHandler={loadListingIntoReactState}
            isButtonDisabled={!sku}
          />
        </Grid>
        {currentListing && (
          <ListingUpdateComponent sku={sku} currentListing={currentListing} />
        )}
      </Container>
    </SWRConfig>
  );
}
