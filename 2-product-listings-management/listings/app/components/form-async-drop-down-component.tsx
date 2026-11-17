import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import { Grid, InputLabel, Tooltip } from "@mui/material";
import useSWR, { useSWRConfig } from "swr";
import { useTranslations } from "use-intl";
import { Fragment, useState } from "react";

/**
 * Options which will be displayed in the dropdown.
 */
export interface Options {
  key: string;
  value: string;
}

/**
 * @param id: HTML identifier for this element
 * @param required: Indicates if this field is optional or not
 * @param disabled: Optional param which indicates if this field is disabled
 * @param label: Form label for this field
 * @param inputFieldLabel: Optional Label which will be displayed on the text field
 * @param noOptionsText: Optional text to be displayed when the fetcher returns empty array.
 * @param helpText: Help text for this field
 * @param onChange: Callback function to handle onChange events
 * @param query: Query value to be passed to the fetcher function
 * @param fetcher: Function which is called to load the data for the drop-down
 */
interface InputProps {
  id: string;
  required: boolean;
  disabled?: boolean;
  label: string;
  inputFieldLabel?: string;
  noOptionsText?: string;
  helpText: string;
  onChange: any;
  query: any;
  fetcher: (query: any) => Promise<Options[]>;
}

/**
 * A dropdown component which can be used to load its options dynamically based on provided context.
 * @param props
 * @constructor
 */
export default function AsyncFormDropDownComponent(props: InputProps) {
  const translations = useTranslations("AsyncFormDropDown");

  const [open, setOpen] = useState(false);

  const { data, error, isLoading } = useSWR(
    open ? props.query : null,
    props.fetcher,
  );
  const { mutate } = useSWRConfig();

  const onPopupOpen = () => {
    setOpen(true);
  };

  const onPopupClose = () => {
    setOpen(false);
    mutate(props.query, undefined, { revalidate: false });
  };

  return (
    <Grid container spacing={3} alignItems="center">
      <Grid item xs={4}>
        <Tooltip title={props.helpText} placement={"right"}>
          <InputLabel htmlFor={props.id}>{props.label}</InputLabel>
        </Tooltip>
      </Grid>
      <Grid item xs={4}>
        <Tooltip
          title={error ? translations("loadingErrorMessage") : props.helpText}
          placement={"right"}
        >
          <Autocomplete
            id={props.id}
            size="small"
            open={open}
            onOpen={onPopupOpen}
            onClose={onPopupClose}
            onChange={props.onChange}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            getOptionLabel={(option) => option.key}
            noOptionsText={props.noOptionsText}
            options={data ? data : []}
            loading={isLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label={error ? translations("error") : props.inputFieldLabel}
                margin="normal"
                size="small"
                error={!!error}
                helperText={error ? translations("loadingErrorMessage") : ""}
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <Fragment>
                      {isLoading ? (
                        <CircularProgress color="inherit" size={20} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </Fragment>
                  ),
                }}
              />
            )}
          />
        </Tooltip>
      </Grid>
    </Grid>
  );
}
