import { Tooltip, TooltipProps } from "@mui/material";

/**
 * Wraps the tooltip children with a span element.
 * @param props the tooltip props
 * @constructor
 */
export default function TooltipWrapper(props: TooltipProps) {
  return (
    <Tooltip {...props}>
      <span>{props.children}</span>
    </Tooltip>
  );
}
