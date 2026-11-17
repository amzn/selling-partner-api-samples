import { Button, Drawer, Grid } from "@mui/material";
import { useTranslations } from "next-intl";
import TooltipWrapper from "./tooltip-wrapper";
import { useState } from "react";

/**
 * A side drawer with a button that opens the side drawer.
 * @param drawerId The identifier of the drawer. e.g. for translation.
 * @param child Child element to display in the drawer.
 * @constructor
 */
const SideDrawerWithButtonComponent = ({
  drawerId,
  child,
}: {
  drawerId: string;
  child: JSX.Element;
}) => {
  const translations = useTranslations(drawerId);
  const [openDrawer, setOpenDrawer] = useState(false);
  const toggleDrawer = (newOpen: boolean) => () => {
    setOpenDrawer(newOpen);
  };
  return (
    <>
      <TooltipWrapper
        title={translations("buttonHelpText")}
        placement={"right"}
        id={`toolTip${drawerId}`}
        data-testid={`toolTip${drawerId}`}
      >
        <Button
          onClick={toggleDrawer(true)}
          id={`button${drawerId}`}
          data-testid={`button${drawerId}`}
        >
          {translations("buttonName")}
        </Button>
      </TooltipWrapper>
      <Drawer
        id={`drawer${drawerId}`}
        data-testid={`drawer${drawerId}`}
        open={openDrawer}
        onClose={toggleDrawer(false)}
        anchor="right"
      >
        <Grid
          container
          justifyContent={"right"}
          sx={{ margin: "1rem 0", padding: "1rem" }}
        >
          {child}
        </Grid>
      </Drawer>
    </>
  );
};

export default SideDrawerWithButtonComponent;
