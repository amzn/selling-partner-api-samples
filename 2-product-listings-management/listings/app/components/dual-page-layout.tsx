import React from "react";
import { Grid } from "@mui/material";

/**
 * A component which displays contents of two pages in a single view using the
 * parallel routes.
 * @param props props for the component.
 * @constructor
 */
export default function DualPageLayout(props: {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
}) {
  return (
    <Grid container spacing={1}>
      <Grid
        item
        xs={6}
        sx={{
          borderRight: "1px solid black",
          overflow: "auto",
          maxHeight: "80vh",
        }}
      >
        {props.leftContent}
      </Grid>
      <Grid
        item
        xs={6}
        sx={{
          borderLeft: "1px solid black",
          overflow: "auto",
          maxHeight: "80vh",
        }}
      >
        {props.rightContent}
      </Grid>
    </Grid>
  );
}
