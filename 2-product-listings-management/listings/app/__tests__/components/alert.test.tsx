import AlertComponent from "@/app/components/alert";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

describe("Alert component", () => {
  const stateHandler = jest.fn();

  test(" Component renders visible success", () => {
    const state = true;

    const { asFragment, getByTestId } = render(
      <AlertComponent
        id={"test"}
        state={state}
        stateHandler={stateHandler}
        severity={"success"}
        message={"success description"}
      />,
    );

    expect(getByTestId("test")).toBeVisible();
    expect(asFragment()).toMatchSnapshot();
  });

  test(" Component renders visible error", () => {
    const openHandler = true;

    const { asFragment, getByTestId } = render(
      <AlertComponent
        id={"test"}
        state={openHandler}
        stateHandler={stateHandler}
        severity={"error"}
        message={"success description"}
      />,
    );

    expect(getByTestId("test")).toBeVisible();
    expect(asFragment()).toMatchSnapshot();
  });
  test(" Component renders visible info", () => {
    const openHandler = true;

    const { asFragment, getByTestId } = render(
      <AlertComponent
        id={"test"}
        state={openHandler}
        stateHandler={stateHandler}
        severity={"info"}
        message={"success description"}
      />,
    );

    expect(getByTestId("test")).toBeVisible();
    expect(asFragment()).toMatchSnapshot();
  });
  test(" Component renders visible warning", () => {
    const openHandler = true;

    const { asFragment, getByTestId } = render(
      <AlertComponent
        id={"test"}
        state={openHandler}
        stateHandler={stateHandler}
        severity={"warning"}
        message={"success description"}
      />,
    );

    expect(getByTestId("test")).toBeVisible();
    expect(asFragment()).toMatchSnapshot();
  });

  test("Component renders invisible", () => {
    const openHandler = false;

    const { asFragment, getByTestId } = render(
      <AlertComponent
        id={"test"}
        state={openHandler}
        stateHandler={stateHandler}
        severity={"success"}
        message={"success description"}
      />,
    );

    expect(getByTestId("test")).not.toBeVisible();
    expect(asFragment()).toMatchSnapshot();
  });
});
