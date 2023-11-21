import RootLayout from "@/app/[locale]/layout";
import { getSettings } from "@/app/api/settings/wrapper";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import { render } from "@testing-library/react";
import { US_LOCALE } from "@/app/constants/global";

function MockedNavigationComponent() {
  return <div> Mocked Navigation Component </div>;
}

function MockedQuickLinkComponent() {
  return <div> Mocked SettingsLink Component </div>;
}

jest.mock("@/app/components/quick-links", () => MockedQuickLinkComponent);

jest.mock(
  "@/app/[locale]/navigation-component",
  () => MockedNavigationComponent,
);

jest.mock("@/app/api/settings/wrapper");
const mockedGetSettings = jest.mocked(getSettings);

async function renderAndMatchSnapshot() {
  const rootLayoutParams = { locale: US_LOCALE };
  const greetingNode = <h1>Hello World</h1>;
  const processedElement = await RootLayout({
    children: greetingNode,
    params: rootLayoutParams,
  });
  const { asFragment } = render(processedElement);
  expect(asFragment()).toMatchSnapshot();
}

describe("Test for the global app level layout", () => {
  test("Snapshot Test for the global app level layout", async () => {
    mockedGetSettings.mockResolvedValue({
      status: 200,
      statusText: "OK",
      settings: MOCK_SETTINGS,
    });

    await renderAndMatchSnapshot();
  });

  test("Test the translations load failure scenario.", async () => {
    const rootLayoutParams = { locale: "en" };
    const greetingNode = <h1>Hello World</h1>;
    expect(async () => {
      await RootLayout({
        children: greetingNode,
        params: rootLayoutParams,
      });
    }).rejects.toThrow(/NEXT_NOT_FOUND/);
  });

  test("test the 404 response code scenario from settings api", async () => {
    mockedGetSettings.mockResolvedValue({
      status: 404,
      statusText: "NOT_FOUND",
      settings: MOCK_SETTINGS,
    });

    await renderAndMatchSnapshot();
  });
});
