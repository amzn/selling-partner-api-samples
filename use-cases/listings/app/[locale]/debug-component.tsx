"use client";
import Button from "@mui/material/Button";
import FullScreenDialog from "@/app/components/full-screen-dialog";
import { useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { DebugContext } from "@/app/context/debug-context-provider";
import ReadOnlySurfaceContainer from "@/app/components/readonly-surface-container";
import { serializeToJsonString } from "@/app/utils/serialization";
import { useTranslations } from "use-intl";
import { Box } from "@mui/material";
import { v4 as uuid } from "uuid";
import TooltipWrapper from "@/app/components/tooltip-wrapper";

/**
 * A component which shows the Selling Partner API request and responses invoked
 * in the page to the user.
 * @constructor
 */
export default function DebugComponent() {
  const pathname = usePathname();
  const debugContext = useContext(DebugContext);
  const [showFullScreenDialog, setShowFullScreenDialog] = useState(false);
  const [shouldRenderDialogContent, setShouldRenderDialogContent] =
    useState(false);
  const translations = useTranslations("DebugConsole");

  const showDebugContentInFullScreenDialog = () => {
    setShowFullScreenDialog(true);
    setShouldRenderDialogContent(true);
  };

  const collapseFullScreenDialog = () => setShowFullScreenDialog(false);

  const clearDebugContextAndDialogContent = () => {
    debugContext.clearDebugContext(pathname);
    setShouldRenderDialogContent(false);
  };

  if (pathname === "/" || pathname === "/settings") {
    return <></>;
  }

  return (
    <>
      <Box
        sx={{
          marginTop: 10,
        }}
      >
        <TooltipWrapper
          title={translations("buttonHelpText")}
          placement={"top-start"}
        >
          <Button
            data-testid="debugButton"
            variant="contained"
            sx={{
              position: "fixed",
              bottom: 0,
              right: 0,
              paddingTop: "5px",
            }}
            onClick={showDebugContentInFullScreenDialog}
            fullWidth
          >
            {translations("buttonName")}
          </Button>
        </TooltipWrapper>
      </Box>

      {showFullScreenDialog && (
        <FullScreenDialog
          isOpen={showFullScreenDialog}
          onClose={collapseFullScreenDialog}
          title={translations("debugDialogTitle")}
          closeButtonHelpText={translations("closeButtonHelpText")}
          actionButtonName={translations("clearButtonName")}
          actionButtonHelpText={translations("clearButtonNameHelpText")}
          actionButtonClickHandler={clearDebugContextAndDialogContent}
        >
          {convertDebugStateToJSX()}
        </FullScreenDialog>
      )}
    </>
  );

  function convertDebugStateToJSX() {
    return debugContext.getRequestResponses(pathname).map((value, index) => {
      const surfaceFieldProps = new Map<string, string>();
      surfaceFieldProps.set("apiName", value.apiName);
      surfaceFieldProps.set("request", serializeToJsonString(value.request));
      surfaceFieldProps.set("response", serializeToJsonString(value.response));

      const translationOverrides = new Map<string, string>();
      translationOverrides.set(
        "apiNameHelpText",
        translations("apiNameHelpText", {
          url: value.apiDocumentationLink,
        }),
      );

      return shouldRenderDialogContent ? (
        <ReadOnlySurfaceContainer
          key={uuid()}
          fieldProps={surfaceFieldProps}
          translationNamespace={"DebugConsole"}
          inputElementIdPrefix={`ReqResponse-${index}`}
          translationOverrides={translationOverrides}
        />
      ) : (
        <></>
      );
    });
  }
}
