import { Grid, InputLabel, MenuItem, Select, Tooltip } from "@mui/material";

/**
 * id: HTML id for this component
 * label: Label text for the dropdown
 * helpText: Helper text which will be displayed on hover
 * selectedKey: Default value text which will be selected on render. Should be one of the elements in the options list.
 * options: List of elements displayed in dropdown. Key: unique identifier for the element. Value: Display label for the element.
 * onChange: Function to handle onchange events
 * disabled: flag to mark the drop-down as disabled.
 * xsDropDownWidth: the maximum width of the drop-down.
 */
interface InputProps {
  id: string;
  label: string;
  helpText: string;
  selectedKey: string;
  options: {
    key: string;
    label: string;
  }[];
  onChange?: any;
  disabled?: boolean;
  xsDropDownWidth?: number;
}

/**
 * Form dropdown input component with static options to be used in the forms.
 * If you need the options to be loaded dynamically based on additional context see @code AsyncFormDropDownComponent
 * @constructor
 */
export default function FormDropDownComponent(props: InputProps) {
  const dropDownWidth = props.xsDropDownWidth ?? 8;
  return (
    <Grid container spacing={3} alignItems="center">
      <Grid item xs={12 - dropDownWidth}>
        <Tooltip title={props.helpText} placement={"right"}>
          <InputLabel htmlFor={props.id}>{props.label}</InputLabel>
        </Tooltip>
      </Grid>
      <Grid item xs={dropDownWidth}>
        <Tooltip title={props.helpText} placement={"right"}>
          <Select
            id={props.id}
            data-testid={props.id}
            key={props.selectedKey}
            value={props.selectedKey}
            variant="outlined"
            size="small"
            onChange={props.onChange}
            disabled={props.disabled}
          >
            {props.options.map((option) => (
              <MenuItem id={props.id} key={option.key} value={option.key}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </Tooltip>
      </Grid>
    </Grid>
  );
}
