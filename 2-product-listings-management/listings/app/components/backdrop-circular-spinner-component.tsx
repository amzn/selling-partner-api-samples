import { Backdrop, CircularProgress } from "@mui/material";

/**
 * Component which uses the basic Backdrop with a Circular Progress component in the foreground
 * to indicate a loading state.
 * @param showSpinner true to show the spinner.
 * @constructor
 */
export default function BackdropCircularSpinnerComponent({
  showSpinner,
}: {
  showSpinner: boolean;
}) {
  if (!showSpinner) {
    return <></>;
  }

  return (
    <Backdrop
      data-testid="backDropCircularSpinner"
      open={showSpinner}
      transitionDuration={{ appear: 0, enter: 0 }}
      sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <CircularProgress color="inherit" />
    </Backdrop>
  );
}
