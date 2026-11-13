import { Button } from "@mui/material";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import BackdropCircularSpinnerComponent from "@/app/components/backdrop-circular-spinner-component";
import AlertDialog from "@/app/components/alert-dialog";
import { v4 as uuid } from "uuid";
import TooltipWrapper from "./tooltip-wrapper";

/**
 * The props for the SaveActionButton.
 */
export interface ActionButtonProps {
  /**
   * name of the button.
   */
  buttonName: string;
  /**
   * help text used on the button.
   */
  buttonHelpText: string;
  /**
   * the id for the button.
   */
  buttonId: string;
  /**
   * list of keys which are used in the useSWR call to fetch the data.
   */
  fetchKeys: any[];
  /**
   * the fetcher which is used to fetch the data.
   * @param keys the keys for the fetcher.
   */
  fetcher: (keys: string[]) => Promise<any>;
  /**
   * the title used on the AlertDialog on fetch failure.
   */
  failureAlertTitle: string;
  /**
   * the content used in the AlertDialog on fetch failure.
   */
  failureAlertContent: string;
  /**
   * the data fetched is handed over to this function to generate the JSX
   * elements which are rendered when the data is available.
   * @param data the data resolved by the fetcher
   * @param onClose callback hook to perform any close activities.
   */
  fetchedDataHandler: (data: any, onClose: () => void) => JSX.Element;
  /**
   * boolean to indicate if the button should be disabled or not.
   */
  isButtonDisabled: boolean;
  /**
   * Controls whether & how to show a confirmation before an action is submitted to the API.
   */
  confirmationOptions?: ConfirmationOptions;
}

/**
 * Props for the confirmation behavior of the button.
 */
interface ConfirmationOptions {
  /**
   * true if button shows a confirmation dialog on click.
   */
  showConfirmation: boolean;
  /**
   * title of the confirmation dialog.
   */
  confirmationTitle: string;
  /**
   * content to show inside the confirmation dialog.
   */
  confirmationContent: string;
  /**
   * The content of the confirmation button.
   */
  confirmationButtonContent: string;
  /**
   * The content of the confirmation cancel button.
   */
  confirmationCancelButtonContent: string;
}

/**
 * A generic button which is used generally on save actions across
 * different pages.
 * @param inputProps props for the SaveActionButton.
 * @constructor
 */
export default function SaveActionButton(inputProps: ActionButtonProps) {
  const [fetchData, setFetchData] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { data, isLoading, error } = useSWR(
    fetchData ? inputProps.fetchKeys : null,
    inputProps.fetcher,
  );
  const { mutate } = useSWRConfig();

  const askConfirmationOrFetchData = () => {
    if (inputProps.confirmationOptions?.showConfirmation) {
      setShowConfirmation(true);
    } else {
      setFetchData(true);
    }
  };

  const hideConfirmation = () => {
    setShowConfirmation(false);
  };

  const hideConfirmationAndFetchData = () => {
    setShowConfirmation(false);
    setFetchData(true);
  };

  const endFetchCall = () => {
    setFetchData(false);
    mutate(inputProps.fetchKeys, undefined, { revalidate: false });
  };

  return (
    <>
      <TooltipWrapper title={inputProps.buttonHelpText} placement={"right"}>
        <Button
          id={inputProps.buttonId}
          data-testid={inputProps.buttonId}
          variant="contained"
          disabled={inputProps.isButtonDisabled}
          onClick={askConfirmationOrFetchData}
        >
          {inputProps.buttonName}
        </Button>
      </TooltipWrapper>
      {isLoading && (
        <BackdropCircularSpinnerComponent showSpinner={isLoading} />
      )}
      {error && (
        <AlertDialog
          key={uuid()}
          title={inputProps.failureAlertTitle}
          content={inputProps.failureAlertContent}
          onClose={endFetchCall}
        />
      )}
      {data && inputProps.fetchedDataHandler(data, endFetchCall)}
      {showConfirmation && (
        <AlertDialog
          title={inputProps.confirmationOptions!.confirmationTitle}
          content={inputProps.confirmationOptions!.confirmationContent}
          onClose={hideConfirmation}
          confirmationOptions={{
            showConfirmation: true,
            confirmationButtonContent:
              inputProps.confirmationOptions!.confirmationButtonContent,
            confirmationCancelButtonContent:
              inputProps.confirmationOptions!.confirmationCancelButtonContent,
            onConfirm: hideConfirmationAndFetchData,
          }}
        />
      )}
    </>
  );
}
