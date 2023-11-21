import { Grid, InputLabel, Tooltip, Button } from "@mui/material";
import { ButtonProps } from "@mui/material/Button/Button";
import TooltipWrapper from "./tooltip-wrapper";

/**
 * id: HTML id for this component
 * label: Display text for the label
 * name: Button name shown in the UI
 * helpText: Help text to be displayed on hover
 * buttonProps: props for the Material UI button.
 */
interface InputProps {
  id: string;
  label: string;
  name: string;
  helpText: string;
  buttonProps: ButtonProps;
}

/**
 * A button with a label.
 * @constructor
 */
export default function FormInputButtonComponent(props: InputProps) {
  return (
    <Grid container spacing={3} alignItems="center">
      <Grid item xs={4}>
        <Tooltip title={props.helpText} placement={"right"}>
          <InputLabel htmlFor={props.id}>{props.label}</InputLabel>
        </Tooltip>
      </Grid>
      <Grid item xs={8}>
        <TooltipWrapper title={props.helpText} placement={"right"}>
          <Button data-testid={props.id} id={props.id} {...props.buttonProps}>
            {props.name}
          </Button>
        </TooltipWrapper>
      </Grid>
    </Grid>
  );
}
