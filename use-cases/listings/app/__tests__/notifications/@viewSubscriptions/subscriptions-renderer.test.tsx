import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import DebuggingContextProvider from "@/app/context/debug-context-provider";
import { IntlProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import React from "react";
import userEvent from "@testing-library/user-event";
import { mockResolveFetchResponse } from "@/app/test-utils/mock-fetch";
import { MOCK_SP_API_RESPONSE } from "@/app/test-utils/mock-debug-context";
import { Subscription } from "@/app/model/types";
import SubscriptionsRenderer from "@/app/[locale]/notifications/@viewSubscriptions/subscriptions-renderer";
import { MOCK_SUBSCRIPTION_1 } from "@/app/test-utils/mock-subscription";
import { US_LOCALE } from "@/app/constants/global";

function renderComponent(subscriptions: Subscription[]) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider>
        <IntlProvider locale={US_LOCALE} messages={translations}>
          <SubscriptionsRenderer subscriptions={subscriptions} />
        </IntlProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the SubscriptionsRenderer", () => {
  test("snapshot test on successful subscription deletion", async () => {
    mockResolveFetchResponse(200, {
      data: {},
      debugContext: [MOCK_SP_API_RESPONSE],
    });

    const { asFragment } = renderComponent([MOCK_SUBSCRIPTION_1]);
    await waitFor(() =>
      expect(screen.queryByTestId("deleteSubscription-0")).not.toBeNull(),
    );
    await act(async () => {
      await userEvent.click(screen.getByTestId("deleteSubscription-0"));
    });
    await waitFor(() =>
      expect(screen.queryByTestId("alertDialog")).not.toBeNull(),
    );
    expect(asFragment()).toMatchSnapshot();
    expect(screen.getByTestId("alertDialog")).toMatchSnapshot();
  });
});
