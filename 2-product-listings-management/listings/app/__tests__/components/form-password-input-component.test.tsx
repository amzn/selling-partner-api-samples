import { render } from "@testing-library/react";
import React from "react";
import FormPasswordInputComponent from "@/app/components/form-password-input-component";

test("Component renders", () => {
  const onChange = jest.fn();

  const { asFragment } = render(
    <FormPasswordInputComponent
      id={"id"}
      value={"Test"}
      required={true}
      helpText={"HelpText"}
      label={"Label"}
      disabled={true}
      onChange={onChange}
    />,
  );

  expect(asFragment()).toMatchSnapshot();
});
