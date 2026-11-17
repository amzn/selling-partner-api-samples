import React, { Dispatch, SetStateAction, useState } from "react";

/**
 * A custom hook for managing the state of text field.
 * @param initialState the initial state of the text field.
 * @param contentChangeCallback callback which is executed on content change event.
 */
export function useStateForTextField(
  initialState: string,
  contentChangeCallback?: (newValue: string) => void,
): [
  string,
  (e: React.ChangeEvent<HTMLInputElement>) => void,
  Dispatch<SetStateAction<string>>,
] {
  const [textFieldContent, setTextFieldContent] = useState(initialState);
  const handleTextFieldContentChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newValue = e.target.value;
    setTextFieldContent(e.target.value);
    if (contentChangeCallback) {
      contentChangeCallback(newValue);
    }
  };

  return [textFieldContent, handleTextFieldContentChange, setTextFieldContent];
}
