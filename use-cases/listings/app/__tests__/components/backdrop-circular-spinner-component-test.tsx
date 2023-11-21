import { render } from "@testing-library/react";
import BackdropCircularSpinnerComponent from "@/app/components/backdrop-circular-spinner-component";

test("component rendering with showSpinner set to true", () => {
  const { asFragment } = render(
    <BackdropCircularSpinnerComponent showSpinner={true} />,
  );
  expect(asFragment()).toMatchSnapshot();
});

test("component rendering with showSpinner set to false", () => {
  const { asFragment } = render(
    <BackdropCircularSpinnerComponent showSpinner={false} />,
  );
  expect(asFragment()).toMatchSnapshot();
});
