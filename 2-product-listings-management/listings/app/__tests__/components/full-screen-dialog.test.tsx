import { render, screen } from "@testing-library/react";
import FullScreenDialog from "@/app/components/full-screen-dialog";

describe("Test for the FullScreenDialog", () => {
  test("verifies the dialog renders with open state set to true", () => {
    render(
      <FullScreenDialog
        isOpen={true}
        onClose={() => {}}
        title={"Title"}
        closeButtonHelpText={"Close"}
      >
        <h1> Body</h1>
      </FullScreenDialog>,
    );

    expect(screen.queryByTestId("fullScreenDialog")).toMatchSnapshot();
  });

  test("verifies the dialog renders with open state set to false", () => {
    render(
      <FullScreenDialog
        isOpen={false}
        onClose={() => {}}
        title={"Title"}
        closeButtonHelpText={"Close"}
      >
        <h1> Body</h1>
      </FullScreenDialog>,
    );

    expect(screen.queryByTestId("fullScreenDialog")).toBeNull();
  });
});
