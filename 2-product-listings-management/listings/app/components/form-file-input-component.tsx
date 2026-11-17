import { Button, Grid, InputLabel, Tooltip, Typography } from "@mui/material";
import React, { ChangeEvent, useState } from "react";
import AlertComponent from "@/app/components/alert";
import { useTranslations } from "use-intl";
import { serializeToJsonString } from "@/app/utils/serialization";
import TooltipWrapper from "./tooltip-wrapper";

/**
 * Props for the FormFileInputComponent.
 */
interface InputProps {
  /**
   * Id for the File Picker button.
   */
  id: string;
  /**
   * Label for the File Picker button.
   */
  label: string;
  /**
   * Name of the File Picker button.
   */
  buttonName: string;
  /**
   * Help text for the File Picker button.
   */
  helpText: string;
  /**
   * This prop helps to validate whether the user chosen file matches one of
   * the MIME types in this prop. An alert is shown if the chosen file type
   * doesn't match.
   * Example : ["application/json"]
   */
  acceptedMIMETypes?: string[];
  /**
   * An alert is shown if the chosen file size exceeds this prop.
   */
  maximumFileSize?: number;
  /**
   * Callback invoked when a valid file is chosen.
   * @param chosenFile the file chosen by user.
   */
  onFile?: (chosenFile: File) => void;
}

/**
 * A component which allows the user to pick a file from the filesystem.
 * @param props the props for the component.
 * @constructor
 */
export default function FormFileInputComponent(props: InputProps) {
  const [selectedFile, setSelectedFile] = useState<File>();
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const translations = useTranslations("FileSelect");

  const validateFileSize = (selectedFile: File) => {
    if (props.maximumFileSize && selectedFile.size > props.maximumFileSize) {
      setAlertMessage(
        translations("exceededMaxFileSize", {
          maxSize: props.maximumFileSize,
        }),
      );
      setShowAlert(true);
      return false;
    }
    return true;
  };

  const validateFileType = (selectedFile: File) => {
    if (
      props.acceptedMIMETypes?.length &&
      !props.acceptedMIMETypes.includes(selectedFile.type)
    ) {
      setAlertMessage(
        translations("incorrectFileType", {
          currentType: selectedFile.type,
          expectedTypes: serializeToJsonString(props.acceptedMIMETypes),
        }),
      );
      setShowAlert(true);
      return false;
    }
    return true;
  };

  const fileChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.currentTarget.files;
    const selectedFile = selectedFiles && selectedFiles[0];
    if (selectedFile) {
      setSelectedFile(selectedFile);
      const selectedFileValid =
        validateFileSize(selectedFile) && validateFileType(selectedFile);
      if (selectedFileValid) {
        setShowAlert(false);
        if (props.onFile) {
          props.onFile(selectedFile);
        }
      }
    }
  };

  return (
    <Grid container spacing={3} alignItems="center">
      <Grid item xs={4}>
        <Tooltip title={props.helpText} placement={"right"}>
          <InputLabel htmlFor={props.id}>{props.label}</InputLabel>
        </Tooltip>
      </Grid>
      <Grid item xs={8}>
        <TooltipWrapper title={props.helpText} placement={"right"}>
          <Button id={props.id} component="label" variant="contained">
            {props.buttonName}
            <input
              data-testid={"hiddenFileInput"}
              type="file"
              accept={
                props.acceptedMIMETypes?.length
                  ? props.acceptedMIMETypes.join()
                  : undefined
              }
              hidden
              onChange={fileChangeHandler}
            />
          </Button>
        </TooltipWrapper>
        {selectedFile && <Typography>{selectedFile.name}</Typography>}
        {showAlert && (
          <AlertComponent
            id={"fileChooserAlert"}
            state={showAlert}
            stateHandler={setShowAlert}
            severity={"error"}
            message={alertMessage}
          />
        )}
      </Grid>
    </Grid>
  );
}
