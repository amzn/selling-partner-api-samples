import { Grid, TextField, InputLabel, Tooltip } from "@mui/material";

/**
 * id: HTML id for this component
 * value: Default value in the TextField on render
 * required: If this field is required in the form
 * disabled: Optional prop to disable the field.
 * label: Display text for the label
 * helpText: Help text to be displayed on hover
 * onChange: Function to handle onChange events
 * multiline: Optional prop to span the content across multiple lines.
 * maxRows: The maximum number of rows of data shown in the text area.
 * fullwidth: Optional prop to use full width for the input components.
 */
interface InputProps {
  id: string;
  value?: string;
  required: boolean;
  disabled?: boolean;
  label: string;
  helpText: string;
  onChange?: any;
  multiline?: boolean;
  maxRows?: number;
  fullwidth?: boolean;
}

/**
 * Form input component to be used in the forms.
 * @constructor
 */
export default function FormInputComponent(props: InputProps) {
  return (
    <Grid container spacing={3} alignItems="center">
      <Grid item xs={4}>
        <Tooltip title={props.helpText} placement={"right"}>
          <InputLabel htmlFor={props.id}>{props.label}</InputLabel>
        </Tooltip>
      </Grid>
      <Grid item xs={8}>
        <Tooltip title={props.helpText} placement={"right"}>
          <TextField
            id={props.id}
            name={props.label}
            required={props.required}
            value={props.value}
            onChange={props.onChange}
            margin="normal"
            size="small"
            disabled={props.disabled}
            multiline={props.multiline}
            maxRows={props.maxRows}
            fullWidth={props.fullwidth}
          />
        </Tooltip>
      </Grid>
    </Grid>
  );
}
