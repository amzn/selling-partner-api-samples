"use client";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { SWRConfig } from "swr";
import {
  SUBSCRIPTIONS_API_PATH,
  SWR_CONFIG_DEFAULT_VALUE,
} from "@/app/constants/global";
import { Container } from "@mui/material";
import TitleComponent from "@/app/components/title";
import SaveActionButton from "@/app/components/save-action-button";
import SubscriptionsRenderer from "@/app/[locale]/notifications/@viewSubscriptions/subscriptions-renderer";
import { Subscription } from "@/app/model/types";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";

/**
 * A component which displays the details of the current subscriptions to the user.
 * @constructor
 */
export default function ViewSubscriptions() {
  const translations = useTranslations("ViewSubscriptions");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>();
  const fetcherForActionButton = useCustomFetcher();
  const buttonName = subscriptions?.length
    ? translations("refreshSubscriptionsButtonName")
    : translations("getSubscriptionsButtonName");

  const loadSubscriptionsIntoReactState = (data: any, onClose: () => void) => {
    onClose();
    setSubscriptions(data as Subscription[]);
    return <></>;
  };

  return (
    <SWRConfig value={SWR_CONFIG_DEFAULT_VALUE}>
      <Container maxWidth={"md"}>
        <TitleComponent title={translations("pageTitle")} />
        <SaveActionButton
          buttonName={buttonName}
          buttonHelpText={translations("getSubscriptionsButtonHelpText")}
          buttonId={"getSubscriptionsButton"}
          fetchKeys={[SUBSCRIPTIONS_API_PATH]}
          fetcher={fetcherForActionButton}
          failureAlertTitle={translations("getSubscriptionsFailureAlertTitle")}
          failureAlertContent={translations(
            "getSubscriptionsFailureAlertContent",
          )}
          fetchedDataHandler={loadSubscriptionsIntoReactState}
          isButtonDisabled={false}
        />
        {subscriptions && (
          <SubscriptionsRenderer subscriptions={subscriptions} />
        )}
      </Container>
    </SWRConfig>
  );
}
