import { JsonSchema7 } from "@jsonforms/core";
import { Button } from "@mui/material";
import Ajv, { ErrorObject } from "ajv";
import SchemaValidationErrorsDialog from "@/app/components/schema-validation-errors-dialog";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { validateDataWithSchema } from "@/app/utils/schema";
import TooltipWrapper from "./tooltip-wrapper";

/**
 * A button which is used to validate the given data with the given schema and
 * reports the errors back to the parent component.
 * @constructor
 */
export default function SchemaValidatorButton({
  data,
  schema,
  validator,
}: {
  data: object;
  schema: JsonSchema7;
  validator: Ajv;
}) {
  const [errors, setErrors] = useState<ErrorObject[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const translations = useTranslations("SchemaValidatorButton");

  return (
    <>
      <TooltipWrapper
        title={translations("schemaValidationsButtonHelpText")}
        placement={"right"}
      >
        <Button
          data-testid="schemaValidatorButton"
          variant="contained"
          onClick={() => {
            setErrors(validateDataWithSchema(validator, schema, data));
            setShowDialog(true);
          }}
        >
          {translations("schemaValidationsButtonName")}
        </Button>
      </TooltipWrapper>
      {showDialog && (
        <SchemaValidationErrorsDialog
          onClose={() => {
            setShowDialog(false);
          }}
          errors={errors}
        />
      )}
    </>
  );
}
