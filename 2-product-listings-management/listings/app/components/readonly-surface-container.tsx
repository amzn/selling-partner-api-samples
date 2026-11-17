import { useTranslations } from "use-intl";
import { Grid, Paper } from "@mui/material";
import SaveActionButton, {
  ActionButtonProps,
} from "@/app/components/save-action-button";
import ReadonlyTextBox from "@/app/components/readonly-text-box";

/**
 * A reusable component which is used to render the given key values into a
 * read only element. This component is used to show any object content.
 * @param fieldProps a map of key values which are to be rendered.
 * @param translationNamespace the namespace for translations.
 * @param inputElementIdPrefix every input element use this same prefix.
 * @param translationOverrides used to override the default translations lookup logic.
 * @param actionButtonProps props for the optional action button.
 * @constructor
 */
export default function ReadOnlySurfaceContainer({
  fieldProps,
  translationNamespace,
  inputElementIdPrefix,
  translationOverrides,
  actionButtonProps,
}: {
  fieldProps: Map<string, string>;
  translationNamespace: string;
  inputElementIdPrefix: string;
  translationOverrides?: Map<string, string>;
  actionButtonProps?: ActionButtonProps;
}) {
  const translations = useTranslations(translationNamespace);

  const getTranslationWithOverrides = (key: string) => {
    return translationOverrides?.get(key) ?? translations(key);
  };

  return (
    <Paper style={{ padding: 10, margin: 15 }} elevation={3}>
      <Grid container spacing={2}>
        {Array.from(fieldProps.entries()).map((entry) => {
          const key = entry[0];
          const value = entry[1];
          const id = `${inputElementIdPrefix}-${key}`;
          return (
            <Grid key={`${id}-item`} item xs={12}>
              <ReadonlyTextBox
                key={id}
                id={id}
                label={getTranslationWithOverrides(key)}
                value={value}
                helpText={getTranslationWithOverrides(`${key}HelpText`)}
              />
            </Grid>
          );
        })}
        <Grid item xs={12}>
          {actionButtonProps && (
            <SaveActionButton
              buttonName={actionButtonProps.buttonName}
              buttonHelpText={actionButtonProps.buttonHelpText}
              buttonId={actionButtonProps.buttonId}
              fetchKeys={actionButtonProps.fetchKeys}
              fetcher={actionButtonProps.fetcher}
              failureAlertTitle={actionButtonProps.failureAlertTitle}
              failureAlertContent={actionButtonProps.failureAlertContent}
              fetchedDataHandler={actionButtonProps.fetchedDataHandler}
              isButtonDisabled={actionButtonProps.isButtonDisabled}
            />
          )}
        </Grid>
      </Grid>
    </Paper>
  );
}
