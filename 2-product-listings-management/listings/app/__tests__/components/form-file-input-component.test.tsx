import "@testing-library/jest-dom";
import FormFileInputComponent from "@/app/components/form-file-input-component";
import { act, screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import translations from "@/app/internationalization/translations/en-US.json";
import {
  createEmptyJsonFile,
  createJsonFile,
} from "@/app/test-utils/mock-file";
import { JSON_FILE_TYPE, US_LOCALE } from "@/app/constants/global";

const MAX_FILE_SIZE = 100000;
function renderFormFileInputComponent(maxFileSize: number) {
  return render(
    <NextIntlClientProvider messages={translations} locale={US_LOCALE}>
      <FormFileInputComponent
        id={"fileUpload"}
        label={"Choose the feed file"}
        buttonName={"Choose File"}
        helpText={"Use the button to pick a file"}
        acceptedMIMETypes={[JSON_FILE_TYPE]}
        maximumFileSize={maxFileSize}
        onFile={(file) => {}}
      />
    </NextIntlClientProvider>,
  );
}

describe("Test for the FormFileInputComponent", () => {
  test("snapshot test for the valid file scenario", async () => {
    const { asFragment } = renderFormFileInputComponent(MAX_FILE_SIZE);
    await act(async () => {
      await userEvent.upload(
        screen.getByTestId("hiddenFileInput"),
        createEmptyJsonFile(),
      );
    });
    expect(asFragment()).toMatchSnapshot();
  });

  test("snapshot test for the max file size exceeded scenario", async () => {
    const { asFragment } = renderFormFileInputComponent(1);
    await act(async () => {
      await userEvent.upload(
        screen.getByTestId("hiddenFileInput"),
        createJsonFile("Json Feed"),
      );
    });
    expect(asFragment()).toMatchSnapshot();
  });
});
