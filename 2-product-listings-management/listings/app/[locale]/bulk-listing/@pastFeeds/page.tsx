"use client";
import SaveActionButton from "@/app/components/save-action-button";
import { useTranslations } from "use-intl";
import {
  FEEDS_API_PATH,
  SWR_CONFIG_DEFAULT_VALUE,
} from "@/app/constants/global";
import FeedsRenderer from "@/app/[locale]/bulk-listing/@pastFeeds/feeds-renderer";
import { Feed } from "@/app/model/types";
import { Container } from "@mui/material";
import TitleComponent from "@/app/components/title";
import { SWRConfig } from "swr";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import { useState } from "react";

/**
 * A component which displays the past submitted feeds to the user.
 * @constructor
 */
export default function PastFeeds() {
  const translations = useTranslations("PastFeeds");
  const fetcherForActionButton = useCustomFetcher();
  const [feeds, setFeeds] = useState<Feed[]>();

  const buttonName = feeds?.length
    ? translations("refreshFeedsButtonName")
    : translations("getFeedsButtonName");
  const pastFeedsDataHandler = (data: any, onClose: () => void) => {
    onClose();
    setFeeds(data as Feed[]);
    return <></>;
  };

  return (
    <SWRConfig value={SWR_CONFIG_DEFAULT_VALUE}>
      <Container maxWidth={"md"}>
        <TitleComponent title={translations("pageTitle")} />
        <SaveActionButton
          buttonName={buttonName}
          buttonHelpText={translations("getFeedsButtonHelpText")}
          buttonId={"getFeedsButton"}
          fetchKeys={[FEEDS_API_PATH]}
          fetcher={fetcherForActionButton}
          failureAlertTitle={translations("getFeedsFailureAlertTitle")}
          failureAlertContent={translations("getFeedsFailureAlertContent")}
          fetchedDataHandler={pastFeedsDataHandler}
          isButtonDisabled={false}
        />
        {feeds && <FeedsRenderer feeds={feeds} />}
      </Container>
    </SWRConfig>
  );
}
