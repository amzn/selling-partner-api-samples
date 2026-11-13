import { Button } from "@mui/material";
import { useContext } from "react";
import { AlertContext } from "@/app/context/alert-context-provider";

/**
 * A button when clicked sets a value for a specific property in product.
 * @param property Includes property key and value to be set for product data.
 * @param setData Function to set the product data
 * @param existingData Existing product data
 */
export interface Property {
  propertyName: string;
  propertyValue: object;
}

export default function SetProductDataButton({
  property,
  existingData,
  setData,
  buttonId,
  buttonText,
  buttonAlert,
}: {
  property: Property;
  existingData: object;
  setData: (data: object) => void;
  buttonId: string;
  buttonText: string;
  buttonAlert: string;
}) {
  const useAlert = () => useContext(AlertContext);
  const { setAlertState } = useAlert();
  const handleProductDataPreset = ({
    propertyName,
    propertyValue,
  }: {
    propertyName: string;
    propertyValue: object;
  }) => {
    setData({
      ...existingData,
      [propertyName]: [propertyValue],
    });
  };
  return (
    <Button
      id={buttonId}
      data-testid={buttonId}
      variant="contained"
      onClick={() => {
        handleProductDataPreset({
          propertyName: property.propertyName,
          propertyValue: property.propertyValue,
        });
        setAlertState({
          isAlert: true,
          content: buttonAlert,
          alertId: "product-data-set",
        });
      }}
    >
      {buttonText}
    </Button>
  );
}
