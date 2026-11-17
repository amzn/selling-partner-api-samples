"use client";
import {
  JSON_FILE_TYPE,
  JSON_LISTINGS_FEED_TYPE,
  MAX_FEED_SIZE_BYTES,
  SUBMIT_FEED_API_PATH,
  SWR_CONFIG_DEFAULT_VALUE,
} from "@/app/constants/global";
import { SWRConfig } from "swr";
import { Container, Grid } from "@mui/material";
import React, { useState } from "react";
import { useTranslations } from "use-intl";
import FormDropDownComponent from "@/app/components/form-drop-down-component";
import FormFileInputComponent from "@/app/components/form-file-input-component";
import FormInputComponent from "@/app/components/form-input-component";
import SaveActionButton from "@/app/components/save-action-button";
import AlertDialog from "@/app/components/alert-dialog";
import { v4 as uuid } from "uuid";
import TitleComponent from "@/app/components/title";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import { useStateForTextField } from "@/app/hooks/useStateForTextField";

/**
 * Component which allows the user to submit listings to Amazon through Json
 * Listings Feed.
 * @constructor
 */
export default function UploadFeeds() {
  const translations = useTranslations("UploadFeeds");
  const [selectedFile, setSelectedFile] = useState<File>();
  const [feedContent, handleFeedContentChange, setFeedContent] =
    useStateForTextField("");
  const fetcherForActionButton = useCustomFetcher((fetcherKeys: string[]) => {
    return {
      method: "POST",
      body: new Blob([feedContent], { type: JSON_FILE_TYPE }),
    };
  });

  const onChosenFile = async (chosenFile: File) => {
    setSelectedFile(chosenFile);
    setFeedContent(await chosenFile.text());
  };
  const showFeedSubmissionDetails = (data: any, onClose: () => void) => (
    <AlertDialog
      title={translations("successAlertTitle")}
      content={translations("successAlertContent", data)}
      key={uuid()}
      onClose={onClose}
    />
  );

  return (
    <SWRConfig value={SWR_CONFIG_DEFAULT_VALUE}>
      <Container maxWidth="md">
        <TitleComponent title={translations("pageTitle")} />
        <Grid container spacing={3}>
          <Grid container item>
            <FormDropDownComponent
              id={"feedTypeDropDown"}
              label={translations("chooseFeedTypeLabel")}
              helpText={translations("chooseFeedTypeHelpText")}
              options={[
                {
                  key: JSON_LISTINGS_FEED_TYPE,
                  label: JSON_LISTINGS_FEED_TYPE,
                },
              ]}
              selectedKey={JSON_LISTINGS_FEED_TYPE}
              disabled={true}
            />
          </Grid>
          <Grid container item>
            <FormFileInputComponent
              id={"fileChooser"}
              label={translations("fileChooserLabel")}
              buttonName={translations("fileChooserButtonName")}
              helpText={translations("fileChooserHelpText", {
                maxSize: MAX_FEED_SIZE_BYTES,
              })}
              acceptedMIMETypes={[JSON_FILE_TYPE]}
              maximumFileSize={MAX_FEED_SIZE_BYTES}
              onFile={onChosenFile}
            />
          </Grid>
          {selectedFile && (
            <Grid container item>
              <FormInputComponent
                id={"feedContent"}
                required={true}
                label={translations("feedContentLabel")}
                helpText={translations("feedContentHelpText")}
                value={feedContent}
                multiline={true}
                fullwidth={true}
                maxRows={20}
                onChange={handleFeedContentChange}
              />
            </Grid>
          )}
          <Grid container item>
            <SaveActionButton
              buttonName={translations("submitButtonName")}
              buttonHelpText={translations("submitButtonHelpText")}
              buttonId={"submitFeed"}
              fetchKeys={[SUBMIT_FEED_API_PATH]}
              fetcher={fetcherForActionButton}
              failureAlertTitle={translations("failureAlertTitle")}
              failureAlertContent={translations("failureAlertContent")}
              fetchedDataHandler={showFeedSubmissionDetails}
              isButtonDisabled={feedContent.length == 0}
            />
          </Grid>
        </Grid>
      </Container>
    </SWRConfig>
  );
}
