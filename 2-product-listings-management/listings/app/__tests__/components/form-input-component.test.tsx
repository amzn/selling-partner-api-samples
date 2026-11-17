import { render } from "@testing-library/react";
import React from "react";
import FormInputComponent from "@/app/components/form-input-component";

test("Component renders", () => {
  const onChange = jest.fn();

  const { asFragment } = render(
    <FormInputComponent
      id={"id"}
      value={"Test"}
      required={true}
      helpText={"HelpText"}
      label={"Label"}
      disabled={true}
      multiline={true}
      fullwidth={true}
      maxRows={20}
      onChange={onChange}
    />,
  );

  expect(asFragment()).toMatchSnapshot();
});
