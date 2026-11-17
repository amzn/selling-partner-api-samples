import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import { SWRConfig } from "swr";
import DebuggingContextProvider, {
  DebugState,
} from "@/app/context/debug-context-provider";
import { US_LOCALE } from "@/app/constants/global";
import SubmissionAccordionComponent from "@/app/components/submission-accordion";

function renderSubmissionAccordion(debugState?: DebugState) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DebuggingContextProvider initialDebugState={debugState}>
        <NextIntlClientProvider locale={US_LOCALE} messages={translations}>
          <SubmissionAccordionComponent />
        </NextIntlClientProvider>
      </DebuggingContextProvider>
    </SWRConfig>,
  );
}

describe("Test for the Submission Accordion", () => {
  test("renders accordion", async () => {
    renderSubmissionAccordion();
    expect(screen.queryByTestId("submission-accordion-one")).toBeVisible();
    expect(screen.queryByTestId("submission-accordion-two")).toBeVisible();
    expect(screen.queryByTestId("submission-accordion-three")).toBeVisible();
    expect(screen.queryByTestId("submission-accordion-four")).toBeVisible();
  });
});
