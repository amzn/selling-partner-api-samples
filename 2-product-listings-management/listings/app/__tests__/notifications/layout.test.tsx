import Layout from "@/app/[locale]/notifications/layout";
import { render } from "@testing-library/react";
import { IntlProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import React from "react";
import { US_LOCALE } from "@/app/constants/global";

const createSubscriptionText = "This is the create subscription page";
const viewSubscriptionsText = "This is the view subscriptions page";

const createSubscriptionNode = <>{createSubscriptionText}</>;
const viewSubscriptionsNode = <>{viewSubscriptionsText}</>;

function renderNotificationsLayout() {
  const { asFragment, queryByText, getByText, queryByTestId } = render(
    <IntlProvider locale={US_LOCALE} messages={translations}>
      <Layout
        createSubscription={createSubscriptionNode}
        viewSubscriptions={viewSubscriptionsNode}
      />
    </IntlProvider>,
  );

  return { asFragment, queryByText, getByText };
}

describe("Test for the Notifications Layout", () => {
  test("Create Subscription is present", async () => {
    const { queryByText } = renderNotificationsLayout();
    const createSubscriptionPage = queryByText(createSubscriptionText);
    expect(createSubscriptionPage).toBeTruthy();
  });

  test("View Subscriptions is present", async () => {
    const { queryByText } = renderNotificationsLayout();
    const viewSubscriptionsPage = queryByText(viewSubscriptionsText);
    expect(viewSubscriptionsPage).toBeTruthy();
  });

  test("Snapshot Test", async () => {
    const { asFragment } = renderNotificationsLayout();
    expect(asFragment()).toMatchSnapshot();
  });
});
