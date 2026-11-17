import { ErrorObject } from "ajv";
import { useTranslations } from "use-intl";
import AlertDialog from "@/app/components/alert-dialog";
import { v4 as uuid } from "uuid";
import { serializeToJsonString } from "@/app/utils/serialization";
import ReadOnlySurfaceContainer from "@/app/components/readonly-surface-container";
import FullScreenDialog from "@/app/components/full-screen-dialog";

/**
 * A functional component which shows the schema validation errors in a Dialog
 * to the user.
 * @param onClose a function which is executed when a user closes the
 * dialog.
 * @param errors list of errors which are shown to the user.
 * @constructor
 */
export default function SchemaValidationErrorsDialog({
  onClose,
  errors,
}: {
  errors: ErrorObject[];
  onClose: () => void;
}) {
  const translations = useTranslations("SchemaValidationErrorsDialog");

  if (!errors?.length) {
    return (
      <AlertDialog
        key={uuid()}
        title={translations("successStatus")}
        content={translations("successMessage")}
        onClose={onClose}
      />
    );
  }

  const errorTextAreas = errors.map((error, index) => {
    const surfaceFieldProps = new Map<string, string>();
    if (error.keyword) surfaceFieldProps.set("keyword", error.keyword);
    if (error.instancePath)
      surfaceFieldProps.set("instancePath", error.instancePath);
    if (error.schemaPath) surfaceFieldProps.set("schemaPath", error.schemaPath);
    if (error.params)
      surfaceFieldProps.set("params", serializeToJsonString(error.params));
    if (error.propertyName)
      surfaceFieldProps.set("propertyName", error.propertyName);
    if (error.message) surfaceFieldProps.set("message", error.message);
    if (error.data)
      surfaceFieldProps.set("data", serializeToJsonString(error.data));
    if (error.schema)
      surfaceFieldProps.set("schema", serializeToJsonString(error.schema));

    return (
      <ReadOnlySurfaceContainer
        key={uuid()}
        fieldProps={surfaceFieldProps}
        translationNamespace={
          "SchemaValidationErrorsDialog.SchemaValidationError"
        }
        inputElementIdPrefix={`SchemaValidationError-${index}`}
      />
    );
  });

  return (
    <FullScreenDialog
      isOpen={true}
      onClose={onClose}
      title={translations("schemaErrors")}
      closeButtonHelpText={translations("closeButtonHelpText")}
    >
      {errorTextAreas}
    </FullScreenDialog>
  );
}
