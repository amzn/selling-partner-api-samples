import { List, ListItem, ListItemText, ListSubheader } from "@mui/material";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  CHILD_JSON_PROPERTY_VALUE,
  PARENT_JSON_PROPERTY_VALUE,
  VARIATION_JSON_PROPERTY,
} from "@/app/constants/global";
import { useTranslations } from "next-intl";
import SetProductDataButton from "../set-product-data-button";

const ProductVariationAccordionComponent = ({
  listing,
  setListing,
}: {
  listing: object;
  setListing: (listing: object) => void;
}) => {
  const translations = useTranslations("ProductVariationAccordion");
  return (
    <Accordion sx={{ width: 450 }}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls="product-variation-content"
        id="product-variation-accordion"
      >
        {translations("accordionTitle")}
      </AccordionSummary>
      <AccordionDetails>
        <List
          subheader={
            <ListSubheader component="div" id="product-variation-subheader">
              {translations("accordionDescription")}
            </ListSubheader>
          }
        >
          <ListItem>
            <ListItemText
              key="product-variation-step-one"
              primary={translations("stepOneDescription")}
              secondary={
                <SetProductDataButton
                  property={{
                    propertyName: VARIATION_JSON_PROPERTY,
                    propertyValue: PARENT_JSON_PROPERTY_VALUE,
                  }}
                  buttonId="product-variation-step-one-button"
                  buttonText={translations("stepOneButtonText")}
                  buttonAlert={translations("stepOneButtonAlert")}
                  existingData={listing}
                  setData={setListing}
                />
              }
            />
          </ListItem>
          <ListItem>
            <ListItemText
              key="product-variation-step-two"
              primary={translations("stepTwoDescription")}
              secondary={
                <SetProductDataButton
                  property={{
                    propertyName: VARIATION_JSON_PROPERTY,
                    propertyValue: CHILD_JSON_PROPERTY_VALUE,
                  }}
                  buttonId="product-variation-step-two-button"
                  buttonText={translations("stepTwoButtonText")}
                  buttonAlert={translations("stepTwoButtonAlert")}
                  existingData={listing}
                  setData={setListing}
                />
              }
            />
          </ListItem>
        </List>
      </AccordionDetails>
    </Accordion>
  );
};

export default ProductVariationAccordionComponent;
