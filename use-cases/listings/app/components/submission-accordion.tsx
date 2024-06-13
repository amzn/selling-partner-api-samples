import { Grid } from "@mui/material";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTranslations } from "next-intl";

/**
 * A accrodion that displays product validation and submission
 * related information.
 * @constructor
 */
const SubmissionAccordionComponent = () => {
  const translations = useTranslations("SubmissionAccordion");
  return (
    <Grid>
      <Accordion sx={{ width: 450 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="submission-accordion-content-one"
          id="submission-accordion-one"
          data-testid="submission-accordion-one"
        >
          {translations("accordionOneTitle")}
        </AccordionSummary>
        <AccordionDetails>
          <p>{translations("accordionOneDescription")}</p>
        </AccordionDetails>
      </Accordion>
      <Accordion sx={{ width: 450 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="submission-accordion-content-two"
          id="submission-accordion-two"
          data-testid="submission-accordion-two"
        >
          {translations("accordionTwoTitle")}
        </AccordionSummary>
        <AccordionDetails>
          <p>{translations("accordionTwoDescription")}</p>
        </AccordionDetails>
      </Accordion>
      <Accordion sx={{ width: 450 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="submission-accordion-content-three"
          id="submission-accordion-three"
          data-testid="submission-accordion-three"
        >
          {translations("accordionThreeTitle")}
        </AccordionSummary>
        <AccordionDetails>
          <p>{translations("accordionThreeDescription")}</p>
        </AccordionDetails>
      </Accordion>
      <Accordion sx={{ width: 450 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="submission-accordion-content-four"
          id="submission-accordion-four"
          data-testid="submission-accordion-four"
        >
          {translations("accordionFourTitle")}
        </AccordionSummary>
        <AccordionDetails>
          <p>{translations("accordionFourDescription")}</p>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
};

export default SubmissionAccordionComponent;
