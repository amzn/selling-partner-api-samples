import {
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Tooltip,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import React from "react";

/**
 * id: HTML id for this component
 * value: Default value in the TextField on render
 * required: If this field is required in the form
 * disabled: Optional prop to disable the field.
 * label: Display text for the label
 * helpText: Help text to be displayed on hover
 * onChange: Function to handle onChange events
 */
interface InputProps {
  id: string;
  value?: string;
  required: boolean;
  disabled?: boolean;
  label: string;
  helpText: string;
  onChange?: any;
}

/**
 * Form input component for passwords and sensitive fields.
 * @constructor
 */
export default function FormPasswordInputComponent(props: InputProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };

  return (
    <Grid container spacing={3} alignItems="center">
      <Grid item xs={4}>
        <Tooltip title={props.helpText} placement={"right"}>
          <InputLabel htmlFor={props.id}>{props.label}</InputLabel>
        </Tooltip>
      </Grid>
      <Grid item xs={8}>
        <Tooltip title={props.helpText} placement={"right"}>
          <FormControl
            id={props.id}
            size={"small"}
            variant="outlined"
            margin={"normal"}
            onChange={props.onChange}
          >
            <OutlinedInput
              id={`outlined-adornment-${props.id}`}
              type={showPassword ? "text" : "password"}
              value={props.value}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label={`toggle ${props.label} visibility`}
                    onClick={handleClickShowPassword}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              }
            />
          </FormControl>
        </Tooltip>
      </Grid>
    </Grid>
  );
}
