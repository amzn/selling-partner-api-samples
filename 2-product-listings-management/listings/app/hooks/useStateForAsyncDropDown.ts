import { Dispatch, SetStateAction, useState } from "react";

/**
 * A custom hook which manages the state for the async drop-down component.
 * @param initialState the initial state of the drop-down.
 */
export function useStateForAsyncDropDown(
  initialState: string,
): [
  string,
  (event: any, newValue: string) => void,
  Dispatch<SetStateAction<string>>,
] {
  const [selectedKey, setSelectedKey] = useState(initialState);
  const handleSelectionChange = (event: any, newValue: string) => {
    setSelectedKey(newValue);
  };

  return [selectedKey, handleSelectionChange, setSelectedKey];
}
