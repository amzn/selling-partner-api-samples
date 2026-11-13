import useSWR from "swr";
import {
  PTD_DEFINITIONS_API_PATH,
  VALIDATION_PREVIEW_MODE,
  VARIATION_JSON_PROPERTY,
} from "@/app/constants/global";
import BackdropCircularSpinnerComponent from "@/app/components/backdrop-circular-spinner-component";
import AlertDialog from "@/app/components/alert-dialog";
import { useTranslations } from "use-intl";
import { generateUISchema } from "@/app/utils/schema";
import { JsonSchema7 } from "@jsonforms/core";
import {
  materialCells,
  materialRenderers,
} from "@jsonforms/material-renderers";
import { JsonForms } from "@jsonforms/react";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { convertLocaleToSPAPIFormat } from "@/app/utils/i18n";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import SchemaValidatorButton from "@/app/components/schema-validator-button";
import { Grid } from "@mui/material";
import { v4 as uuid } from "uuid";
import ListingSubmitButton from "@/app/components/listing-submit-button";
import ConvertToJsonFeed from "@/app/components/convert-to-json-feed-button";
import { useCustomFetcher } from "@/app/hooks/useCustomFetcher";
import SubmissionAccordionComponent from "./submission-accordion";
import SideDrawerWithButtonComponent from "./side-drawer-with-button";
import ProductVariationAccordionComponent from "./listing/accordion-product-variation";

/**
 * A component which retrieves the schema for the given product type and
 * renders an editor to allow the user to enter the listing attributes.
 * @param sku the SKU.
 * @param productType the product type.
 * @param useCase the user case where this component is used in the app.
 * @param initialListing the initial listing loaded into the editor.
 * @param writeOperation the write operation to be used when the use case is update listing.
 * @constructor
 */
export default function ListingAttributesEditorComponent({
  sku,
  productType,
  useCase,
  initialListing,
  writeOperation,
}: {
  sku: string;
  productType: string;
  useCase: string;
  initialListing: object;
  writeOperation?: string;
}) {
  const [listing, setListing] = useState(initialListing);
  const translations = useTranslations("ListingAttributesEditor");
  const locale = useLocale();

  const fetcher = useCustomFetcher((fetcherKeys: string[]) => {
    const [url, productType, useCase, locale] = fetcherKeys;
    return {
      headers: {
        productType: productType,
        useCase: useCase,
        locale: locale,
      },
    };
  });

  useEffect(() => {
    setListing(initialListing);
  }, [initialListing]);

  const schemaValidator = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false,
    validateSchema: false,
  });
  addFormats(schemaValidator);

  const { data, error, isLoading } = useSWR(
    [
      PTD_DEFINITIONS_API_PATH,
      productType,
      useCase,
      convertLocaleToSPAPIFormat(locale),
    ],
    fetcher,
  );

  if (isLoading) {
    return <BackdropCircularSpinnerComponent showSpinner={isLoading} />;
  }

  if (error) {
    return (
      <AlertDialog
        key={uuid()}
        title={translations("failureAlertTitle")}
        content={translations("failureAlertContent")}
      />
    );
  }

  if (data) {
    const originalSchema: JsonSchema7 = data;
    const uiSchema = generateUISchema(originalSchema);
    return (
      <Grid data-testid="listingAttributesEditor">
        {originalSchema.properties?.[VARIATION_JSON_PROPERTY] && (
          <SideDrawerWithButtonComponent
            drawerId="OptionalInformationPanel"
            child={
              <ProductVariationAccordionComponent
                listing={listing}
                setListing={setListing}
              />
            }
          />
        )}
        <JsonForms
          ajv={schemaValidator}
          schema={originalSchema}
          uischema={uiSchema}
          data={listing}
          renderers={materialRenderers}
          cells={materialCells}
          onChange={({ data, errors }) => {
            setListing(data);
          }}
        />

        <Grid container justifyContent={"right"} sx={{ margin: "1rem 0" }}>
          <SideDrawerWithButtonComponent
            drawerId="ListingAttributesSubmissionSideDrawer"
            child={<SubmissionAccordionComponent />}
          />
        </Grid>

        <Grid container justifyContent={"right"} sx={{ margin: "1rem 0" }}>
          <SchemaValidatorButton
            data={listing}
            schema={originalSchema}
            validator={schemaValidator}
          />
        </Grid>

        <Grid container justifyContent={"right"} sx={{ margin: "1rem 0" }}>
          <ListingSubmitButton
            buttonId="ListingSubmitPreviewButton"
            sku={sku}
            productType={productType}
            useCase={useCase}
            currentListing={listing}
            initialListing={initialListing}
            writeOperation={writeOperation}
            mode={VALIDATION_PREVIEW_MODE}
          />
        </Grid>

        <Grid container justifyContent={"right"} sx={{ margin: "1rem 0" }}>
          <ListingSubmitButton
            buttonId="ListingSubmitButton"
            sku={sku}
            productType={productType}
            useCase={useCase}
            currentListing={listing}
            initialListing={initialListing}
            writeOperation={writeOperation}
          />
        </Grid>

        <Grid container justifyContent={"right"} sx={{ margin: "1rem 0" }}>
          <ConvertToJsonFeed
            sku={sku}
            listing={listing}
            initialListing={initialListing}
            useCase={useCase}
            productType={productType}
            writeOperation={writeOperation}
          />
        </Grid>
      </Grid>
    );
  }

  return <></>;
}
