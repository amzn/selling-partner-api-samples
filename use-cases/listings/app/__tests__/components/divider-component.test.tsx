import { render } from "@testing-library/react";
import React from "react";
import { DividerComponent } from "@/app/components/divider-component";

test("Component renders", () => {
  const { asFragment } = render(<DividerComponent />);
  expect(asFragment()).toMatchSnapshot();
});
