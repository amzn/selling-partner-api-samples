import { render } from "@testing-library/react";
import React from "react";
import TitleComponent from "@/app/components/title";

test("Component renders", () => {
  const { asFragment } = render(<TitleComponent title={"Test Title page"} />);

  expect(asFragment()).toMatchSnapshot();
});
