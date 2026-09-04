"""
Reports API Recipe: Request and Retrieve a Report
=================================================

This recipe shows a simple, end-to-end Reports flow in four steps:

1. Request a report with `create_report`, which returns a reportId.
2. Wait for a REPORT_PROCESSING_FINISHED notification and read the reportDocumentId
   from its payload.
3. Call `get_report_document` with the reportDocumentId to get a pre-signed download
   URL and, optionally, the compression algorithm used.
4. Download the document and read the contents. GZIP reports are decompressed with
   `gzip.decompress`.

Real-world notes:
- Step 2 usually happens asynchronously (via SQS/SNS/EventBridge). Here we simulate a
  notification so the flow is easy to read and easy to test.
- Docs: https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference
"""

import gzip
import json
import urllib.request
from typing import Any, Dict, Optional

from spapi import SPAPIClient, SPAPIConfig, ReportsApi
from spapi.models.reports_v2021_06_30.create_report_specification import (
    CreateReportSpecification,
)
from src.recipes.reports import constants
from src import config
from src.util.recipe import Recipe


class RequestAndRetrieveReportRecipe(Recipe):
    """
    A small helper class that encapsulates the Reports flow:

    * request_report(): calls create_report and returns reportId
    * handle_notification(): inspects the notification and picks the reportDocumentId
    * get_report_document(): calls get_report_document(report_document_id=...)
    * download_and_read_document(): downloads and (optionally) gunzips the document

    In production you would typically:
    - Call request_report() in one component.
    - Receive the notification in another component.
    - Use handle_notification() + get_report_document() + download_and_read_document() there.
    """

    def __init__(
        self,
        config: Optional[SPAPIConfig] = None,
        reports_api: Optional[ReportsApi] = None,
        notification_body: Optional[Any] = None,
    ) -> None:
        super().__init__(config=config)
        # Allow injection of a mocked API for tests
        self._reports_api = reports_api
        self._notification_body = (
            notification_body or constants.sample_report_notification
        )

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    @property
    def reports_api(self) -> ReportsApi:
        if self._reports_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url,
            )
            self._reports_api = ReportsApi(client.api_client)
            print("Reports API client initialized successfully.")
        return self._reports_api

    # -------------------------------------------------------------------------
    # Step 1 - Request a report
    # -------------------------------------------------------------------------

    def request_report(self) -> str:
        """
        Request a report by report type and marketplace using create_report.

        Returns:
            reportId (str): The ID of the report created by the Reports API.
        """
        specification = CreateReportSpecification(
            report_type=constants.sample_report_type,
            marketplace_ids=[constants.sample_marketplace_id],
        )
        # Optional: bound the report data window with data_start_time / data_end_time,
        # and pass report-type-specific options via report_options.

        response = self.reports_api.create_report(body=specification)
        report_id = response.report_id
        print(f"[Step 1] Report requested successfully. reportId = {report_id}")
        return report_id

    # -------------------------------------------------------------------------
    # Step 2 - Handle REPORT_PROCESSING_FINISHED notification
    # -------------------------------------------------------------------------

    def handle_notification(self, notification_body: Any) -> Optional[str]:
        """
        Parse a REPORT_PROCESSING_FINISHED notification and extract the reportDocumentId.

        Args:
            notification_body: Raw JSON string or dict with the notification.

        Returns:
            reportDocumentId (str) if the report is DONE and produced a document,
            otherwise None.
        """
        # Accept both raw JSON string and dict
        if isinstance(notification_body, str):
            try:
                notification = json.loads(notification_body)
            except json.JSONDecodeError as e:
                print(f"Invalid JSON notification: {e}")
                return None
        else:
            notification = notification_body

        notification_type = notification.get("notificationType")
        if notification_type != "REPORT_PROCESSING_FINISHED":
            print(f"[Step 2] Ignored wrong notificationType: {notification_type}")
            return None

        details = notification.get("payload", {}).get(
            "reportProcessingFinishedNotification", {}
        )
        report_id = details.get("reportId")
        status = details.get("processingStatus")
        report_document_id = details.get("reportDocumentId")

        print(f"[Step 2] Notification for reportId={report_id}, status={status}")

        if status == "DONE" and report_document_id:
            print(f"[Step 2] Using reportDocumentId={report_document_id}")
            return report_document_id

        print(f"[Step 2] No downloadable document from notification (status={status}).")
        return None

    # -------------------------------------------------------------------------
    # Step 3 - Call get_report_document(report_document_id=...)
    # -------------------------------------------------------------------------

    def get_report_document(self, report_document_id: str) -> Dict[str, Any]:
        """
        Call get_report_document(report_document_id=...) and return the metadata as a
        plain dict.

        The metadata typically includes:
        - url: pre-signed URL
        - compressionAlgorithm: e.g. GZIP (when the report contents are compressed)
        """
        print(
            f"[Step 3] Calling get_report_document for report_document_id={report_document_id}"
        )
        response = self.reports_api.get_report_document(report_document_id)

        if hasattr(response, "to_dict"):
            return response.to_dict()
        return response

    # -------------------------------------------------------------------------
    # Step 4 - Download and read document from pre-signed URL
    # -------------------------------------------------------------------------

    def download_and_read_document(self, document_metadata: Dict[str, Any]) -> str:
        """
        Download the report document and return its text contents.

        Handles GZIP compression, signalled either by the HTTP Content-Encoding header
        or by compressionAlgorithm=GZIP in the metadata.

        Returns:
            The report contents as a UTF-8 string (most reports are tab-delimited flat files).
        """
        url = document_metadata.get("url")
        if not url:
            raise RuntimeError("Report document metadata does not contain a URL.")

        print(f"[Step 4] Downloading report document from: {url}")

        # Download raw bytes
        with urllib.request.urlopen(url) as response:
            data = response.read()
            content_encoding = response.info().get("Content-Encoding")

        # GZIP reports are served as raw gzip bytes and must be decompressed explicitly.
        compression = document_metadata.get("compressionAlgorithm")
        if content_encoding == "gzip" or (
            compression and str(compression).upper() == "GZIP"
        ):
            print("[Step 4] compressionAlgorithm=GZIP; decompressing report document.")
            data = gzip.decompress(data)

        content = data.decode("utf-8")
        print("[Step 4] Report content (first 1000 chars):")
        print(content[:1000])
        return content

    # -------------------------------------------------------------------------
    # Main recipe entry point
    # -------------------------------------------------------------------------

    def start(self) -> None:
        """
        Main entry point showing the complete Reports flow.
        """
        report_id = self.request_report()
        print(f"Report requested with ID: {report_id}")

        report_document_id = self.handle_notification(self._notification_body)
        if not report_document_id:
            print("No downloadable report document available. Stopping.")
            return

        metadata = self.get_report_document(report_document_id)
        self.download_and_read_document(metadata)
        print("Report retrieved successfully.")


# -----------------------------------------------------------------------------
# Example usage for local/manual runs (not used in unit tests)
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    recipe = RequestAndRetrieveReportRecipe()
    recipe.start()
