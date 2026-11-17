import { Grid, Typography } from "@mui/material";
import React from "react";
import { Variant } from "@mui/material/styles/createTypography";

/**
 * title: Title of the page
 */
interface InputProps {
  title: string;
  variant?: Variant;
}

/**
 * Standard component for displaying page title across the app.
 * @param props Translated name of the page
 */
export default function TitleComponent(props: InputProps) {
  return (
    <Grid container spacing={3} alignItems="left" justifyContent="flex-start">
      <Grid item>
        <Typography variant={props.variant || "h6"}>{props.title}</Typography>
      </Grid>
    </Grid>
  );
}
