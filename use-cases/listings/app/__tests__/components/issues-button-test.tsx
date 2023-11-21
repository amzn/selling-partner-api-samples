import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import { MOCK_ISSUE } from "@/app/test-utils/mock-issue";
import userEvent from "@testing-library/user-event";
import IssuesButton from "@/app/components/issues-button";
import { US_LOCALE } from "@/app/constants/global";

function renderIssuesButton() {
  return render(
    <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
      <IssuesButton issues={[MOCK_ISSUE]} />
    </NextIntlClientProvider>,
  );
}

describe("Test for the IssuesButton", () => {
  test("test if the button displays dialog on click", async () => {
    const { asFragment } = renderIssuesButton();
    expect(asFragment()).toMatchSnapshot();
    await userEvent.click(screen.getByTestId("issuesButton"));

    await waitFor(() =>
      expect(screen.queryByTestId("fullScreenDialog")).toBeVisible(),
    );
    expect(screen.queryByTestId("fullScreenDialog")).toMatchSnapshot();
    await userEvent.click(screen.getByTestId("cancelFullScreenDialog"));
    await waitFor(() =>
      expect(screen.queryByTestId("fullScreenDialog")).toBeNull(),
    );
  });
});
