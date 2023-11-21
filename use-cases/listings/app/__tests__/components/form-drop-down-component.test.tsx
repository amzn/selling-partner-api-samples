import { render } from "@testing-library/react";
import React from "react";
import FormDropDownComponent from "@/app/components/form-drop-down-component";

test("Component renders", () => {
  const onChange = jest.fn();

  const { asFragment } = render(
    <FormDropDownComponent
      id={"id"}
      label={"Test"}
      helpText={"HelpText"}
      selectedKey={"Default"}
      disabled={true}
      options={[
        { key: "key", label: "Default" },
        { key: "SomethingElse", label: "Default" },
      ]}
      onChange={onChange}
    />,
  );

  expect(asFragment()).toMatchSnapshot();
});
