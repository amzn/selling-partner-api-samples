import { Divider } from "@mui/material";

/**
 * Component which creates a Divider which can be used to separate logical sections in a page.
 * @constructor
 */
export function DividerComponent() {
  return (
    <Divider
      style={{
        margin: "1rem 0",
        borderBottomWidth: "3px",
        borderColor: "#333",
      }}
    />
  );
}
