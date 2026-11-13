import { Subscription } from "@/app/model/types";
import { useTranslations } from "use-intl";
import ReadOnlySurfaceContainer from "@/app/components/readonly-surface-container";
import { v4 as uuid } from "uuid";
import { SUBSCRIPTIONS_API_PATH } from "@/app/constants/global";
import AlertDialog from "@/app/components/alert-dialog";
import { serializeToJsonString } from "@/app/utils/serialization";
import AlertComponent from "@/app/components/alert";
import { Box } from "@mui/material";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";

/**
 * A component which displays the details of the subscriptions.
 * @param subscriptions list of subscriptions to render.
 * @constructor
 */
export default function SubscriptionsRenderer({
  subscriptions,
}: {
  subscriptions: Subscription[];
}) {
  const translations = useTranslations("SubscriptionContainer");
  const fetcherForActionButton = useCustomFetcher((fetcherKeys: string[]) => {
    const [url, subscription] = fetcherKeys;
    return {
      method: "DELETE",
      body: serializeToJsonString(subscription),
    };
  });

  const showSuccessfulAlert = (data: any, onClose: () => void) => (
    <AlertDialog
      key={uuid()}
      title={translations("successAlertTitle")}
      content={translations("successAlertContent")}
      onClose={onClose}
    />
  );

  const subscriptionContainers = subscriptions.map((subscription, index) => {
    const surfaceFieldProps = new Map<string, string>();
    surfaceFieldProps.set("id", subscription.subscriptionId);
    surfaceFieldProps.set("type", subscription.notificationType);
    surfaceFieldProps.set("eventBusName", subscription?.eventBusName || "");
    surfaceFieldProps.set("filterRule", subscription?.eventBusFilterRule || "");
    surfaceFieldProps.set("queueName", subscription?.sqsQueueName || "");

    return (
      <ReadOnlySurfaceContainer
        key={subscription.subscriptionId}
        fieldProps={surfaceFieldProps}
        translationNamespace={"SubscriptionContainer"}
        inputElementIdPrefix={`SubscriptionContainer-${index}`}
        actionButtonProps={{
          isButtonDisabled: false,
          buttonId: `deleteSubscription-${index}`,
          buttonName: translations("actionButtonName"),
          buttonHelpText: translations("actionButtonHelpText"),
          fetchKeys: [SUBSCRIPTIONS_API_PATH, subscription],
          fetcher: fetcherForActionButton,
          fetchedDataHandler: showSuccessfulAlert,
          failureAlertTitle: translations(
            "deleteSubscriptionFailureAlertTitle",
          ),
          failureAlertContent: translations(
            "deleteSubscriptionFailureAlertContent",
          ),
        }}
      />
    );
  });

  return (
    <>
      {subscriptions.length > 0 ? (
        subscriptionContainers
      ) : (
        <Box marginTop={5}>
          <AlertComponent
            id={"no-subscription"}
            state={true}
            stateHandler={() => {}}
            severity={"info"}
            message={translations("noSubscriptionAlert")}
            staticAlert={true}
          />
        </Box>
      )}
    </>
  );
}
