"use client";

import React from "react";
import { Container, Grid, Typography } from "@mui/material";

/**
 * The error page for the whole application when unknown error happen during render the page.
 * @constructor
 */
export default function ErrorRender() {
  return (
    <Container maxWidth="md">
      <Grid
        container
        spacing={3}
        alignItems="center"
        justifyContent="flex-start"
      >
        <Grid item>
          <Typography variant="h6">Something went wrong!</Typography>
        </Grid>
      </Grid>
    </Container>
  );
}
