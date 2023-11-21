import { Grid, InputLabel, Tooltip, Box, Typography } from "@mui/material";

/**
 * id: HTML id for this component
 * value: Default value in the TextBox on render
 * label: Display text for the label
 * helpText: Help text to be displayed on hover
 */
interface InputProps {
  id: string;
  value: string;
  label: string;
  helpText: string;
}

/**
 * Component used to render the read-only fields.
 * @constructor
 */
export default function ReadonlyTextBox(props: InputProps) {
  return (
    <Grid container spacing={3} alignItems="center">
      <Grid item xs={4}>
        <Tooltip title={props.helpText} placement={"right"}>
          <InputLabel htmlFor={props.id}>{props.label}</InputLabel>
        </Tooltip>
      </Grid>
      <Grid item xs={8}>
        <Tooltip title={props.helpText} placement={"right"}>
          <Box
            id={props.id}
            sx={{
              border: "1px solid",
              borderColor: "grey.500",
              padding: 1,
              "&:hover": {
                border: "2px solid",
                borderColor: "primary.dark",
              },
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
              wordBreak: "break-word",
              wordWrap: "break-word",
            }}
          >
            <Typography>{props.value}</Typography>
          </Box>
        </Tooltip>
      </Grid>
    </Grid>
  );
}
