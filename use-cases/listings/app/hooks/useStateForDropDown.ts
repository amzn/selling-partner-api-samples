import { Dispatch, SetStateAction, useState } from "react";
import { SelectChangeEvent } from "@mui/material";

/**
 * A custom hook for managing the state of drop-down.
 * @param initialState the initial state of the drop-down.
 * @param selectionChangeCallback callback which is executed on selection change event.
 */
export function useStateForDropDown(
  initialState: string,
  selectionChangeCallback?: (selectedKey: any) => void,
): [string, (e: SelectChangeEvent) => void, Dispatch<SetStateAction<string>>] {
  const [selectedKey, setSelectedKey] = useState(initialState);

  const handleSelectionChange = (e: SelectChangeEvent) => {
    const selectedKey = e.target.value;
    setSelectedKey(selectedKey);
    if (selectionChangeCallback) {
      selectionChangeCallback(selectedKey);
    }
  };

  return [selectedKey, handleSelectionChange, setSelectedKey];
}
