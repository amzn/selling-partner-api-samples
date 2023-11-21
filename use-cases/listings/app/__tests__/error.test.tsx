import React from "react";
import { render, screen } from "@testing-library/react";
import ErrorRender from "@/app/[locale]/error";

describe("Error Component", () => {
  it("renders an error message", () => {
    const error = new Error("Test error message");
    const reset = jest.fn();
    const { asFragment } = render(<ErrorRender error={error} reset={reset} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
