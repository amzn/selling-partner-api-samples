import { useTranslations } from "use-intl";
import FormInputComponent from "@/app/components/form-input-component";
import ListingAttributesEditorComponent from "@/app/components/listing-attributes-editor-component";
import { useStateForTextField } from "@/app/hooks/useStateForTextField";

const ListingCreationFormComponent = ({
  chosenProductType,
  useCase,
}: {
  chosenProductType: string;
  useCase: string;
}) => {
  const translations = useTranslations("ListingCreationFormComponent");
  const [sku, handleSkuChange] = useStateForTextField("");

  return (
    <>
      <FormInputComponent
        id={"sku"}
        required={true}
        label={translations("sku")}
        helpText={translations("skuHelpText")}
        value={sku}
        onChange={handleSkuChange}
      />
      {sku && (
        <ListingAttributesEditorComponent
          key={chosenProductType}
          sku={sku}
          productType={chosenProductType}
          useCase={useCase}
          initialListing={{}}
        />
      )}
    </>
  );
};

export default ListingCreationFormComponent;
