"""
Reports API Recipe: Request, Retrieve and Download a Report
===========================================================

This recipe shows the complete, end-to-end Reports flow in four steps:

1. Request a report with `create_report`, which returns a reportId.
2. Wait for the report to finish processing. Subscribe to the REPORT_PROCESSING_FINISHED
   notification and read the reportDocumentId from its payload (see `handle_notification`).
3. Call `get_report_document` with the reportDocumentId to get a short-lived, pre-signed
   S3 download URL and, optionally, the compressionAlgorithm used.
4. Download the document and parse it correctly.

Step 4 is where a naive `response.decode("utf-8")` goes wrong. Three things make report
documents tricky:

* Character encoding: SP-API reports are NOT all UTF-8. Some are Windows-1252,
  Japanese-marketplace reports use Shift-JIS (Windows-31J), and some UTF-8 reports
  begin with a Byte Order Mark (BOM). Encoding can also differ by marketplace and
  change over time, so it is read from the download's Content-Type header rather than
  assumed. The getReportDocument API response itself never carries a charset; only the
  pre-signed S3 download does.
* Document format: reports come as delimited text (TSV/CSV), JSON, XML, or binary
  (e.g. FBA_BULK_INVOICE is a .tar.gz of PDFs, FEE_DISCOUNTS_REPORT is an .xlsx,
  GET_EASYSHIP_DOCUMENTS is a PDF). Binary reports must be returned as raw bytes,
  never decoded as text.
* Compression: the getReportDocument response may report a compressionAlgorithm
  (e.g. GZIP). This transport-level compression is separate from a report whose
  *content* is itself an archive.

Because the pre-signed URL is only valid for a short period of time (a few minutes), the
download is retried on failure and each attempt re-fetches a fresh URL via
get_report_document rather than reusing one that may already have expired.

Real-world notes:
- Step 2 usually happens asynchronously (via SQS/SNS/EventBridge). Here we simulate a
  notification so the flow is easy to read and easy to test.
- Docs: https://developer-docs.amazon.com/sp-api/docs/reports-api-v2021-06-30-reference
"""

import gzip
import json
import time
import xml.etree.ElementTree as ET
from typing import Any, Dict, Optional

import requests

from spapi import SPAPIClient, SPAPIConfig, ReportsApi
from spapi.models.reports_v2021_06_30.create_report_specification import (
    CreateReportSpecification,
)
from src.recipes.reports import constants
from src import config
from src.util.recipe import Recipe


class RequestAndRetrieveReportRecipe(Recipe):
    """
    A small helper class that encapsulates the complete Reports flow:

    * request_report(): calls create_report and returns reportId
    * handle_notification(): inspects the notification and picks the reportDocumentId
    * get_report_document(): calls get_report_document(report_document_id=...)
    * download_and_read_document(): downloads (with retry + fresh URL per attempt) and
      parses the document, honoring charset, compression and document format

    In production you would typically:
    - Call request_report() in one component.
    - Receive the notification in another component.
    - Use handle_notification() + download_and_read_document() there.
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
        - url: pre-signed S3 URL. It is short-lived (a few minutes), so download it
          immediately and do not cache it.
        - compressionAlgorithm: e.g. GZIP (when the report contents are compressed).
        """
        print(
            f"[Step 3] Calling get_report_document for report_document_id={report_document_id}"
        )
        response = self.reports_api.get_report_document(report_document_id)

        if hasattr(response, "to_dict"):
            return response.to_dict()
        return response

    # -------------------------------------------------------------------------
    # Step 4 - Download and parse the document from the pre-signed URL
    # -------------------------------------------------------------------------

    def download_and_read_document(self, report_document_id: str) -> Dict[str, Any]:
        """
        Download the report document (with retry) and parse it into a structured result.

        Because pre-signed URLs are short-lived, every attempt re-fetches the document
        metadata via get_report_document to obtain a fresh URL rather than reusing one
        that may already have expired.

        Returns:
            A dict describing the parsed report:
              {"kind": "text",   "text": str}                 # delimited flat file (TSV/CSV)
              {"kind": "json",   "data": <parsed JSON>}
              {"kind": "xml",    "root": xml.etree.Element}
              {"kind": "binary", "content_type": str, "bytes": bytes}
        """
        last_error: Optional[Exception] = None

        for attempt in range(1, constants.download_max_attempts + 1):
            # Re-fetch a fresh pre-signed URL on every attempt (they expire quickly).
            metadata = self.get_report_document(report_document_id)
            url = metadata.get("url")
            if not url:
                raise RuntimeError("Report document metadata does not contain a URL.")

            print(
                f"[Step 4] Downloading report document (attempt {attempt} of "
                f"{constants.download_max_attempts}) from: {url}"
            )
            try:
                report = self._download_report(
                    url, metadata.get("compressionAlgorithm")
                )
                self._print_report_preview(report)
                print("Report retrieved successfully.")
                return report
            except Exception as e:  # noqa: BLE001 - demonstrate retry on any download error
                last_error = e
                print(f"[Step 4] Download attempt {attempt} failed: {e}")
                if attempt < constants.download_max_attempts:
                    self._sleep_before_retry(attempt)

        raise RuntimeError(
            f"Failed to download report document after "
            f"{constants.download_max_attempts} attempts."
        ) from last_error

    def _download_report(
        self, url: str, compression_algorithm: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Download and parse any SP-API report document from a pre-signed URL.

        Args:
            url: the pre-signed S3 URL from the getReportDocument response.
            compression_algorithm: the getReportDocument `compressionAlgorithm`
                value (e.g. "GZIP"), or None.
        """
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        data = resp.content  # raw bytes; do NOT use resp.text (it guesses the charset)

        # 1) Transport-level decompression, if getReportDocument reported it.
        #    This is separate from a report whose *content* is itself an archive
        #    (e.g. FBA_BULK_INVOICE is a .tar.gz of PDFs) - those arrive with NO
        #    compressionAlgorithm and are handled as binary below.
        #
        #    Guard on the gzip magic number (0x1f 0x8b): a pre-signed S3 download
        #    delivers GZIP reports as raw gzip bytes that we must inflate ourselves,
        #    but if the server sent Content-Encoding: gzip the HTTP client (requests)
        #    has already transparently decompressed the body - inflating again would
        #    fail. Checking the magic bytes makes this correct either way.
        if (
            compression_algorithm
            and compression_algorithm.upper() == "GZIP"
            and data[:2] == b"\x1f\x8b"
        ):
            print("[Step 4] compressionAlgorithm=GZIP; decompressing report document.")
            data = gzip.decompress(data)

        content_type = resp.headers.get("Content-Type", "").lower()

        # 2) Binary reports: return bytes untouched (PDF, XLSX, ZIP, .tar.gz, ...).
        if any(
            tok in content_type
            for tok in (
                "application/pdf",
                "octet-stream",
                "zip",
                "gzip",
                "vnd.ms-excel",
                "spreadsheetml",
                "vnd.openxmlformats",
            )
        ):
            print(f"[Step 4] Binary report (content_type={content_type}).")
            return {"kind": "binary", "content_type": content_type, "bytes": data}

        # 3) Text: decode with the download's charset (reports are not all UTF-8;
        #    some are Windows-1252, JP reports use Shift-JIS), then strip a BOM.
        text = self._decode_text(data, content_type)

        # 4) Dispatch on Content-Type, with a first-character fallback because
        #    SP-API sometimes labels JSON/XML report bodies as text/plain.
        head = text.lstrip()[:1]
        if "json" in content_type or head in ("{", "["):
            print("[Step 4] Parsed JSON report.")
            return {"kind": "json", "data": json.loads(text)}
        if "xml" in content_type or head == "<":
            # parse from raw bytes so the XML prolog's declared encoding is honored
            print("[Step 4] Parsed XML report.")
            return {"kind": "xml", "root": ET.fromstring(data)}

        # 5) Otherwise a delimited flat file (TSV/CSV) - return the decoded text.
        print("[Step 4] Decoded delimited (TSV/CSV) report.")
        return {"kind": "text", "text": text}

    @staticmethod
    def _decode_text(data: bytes, content_type: str) -> str:
        """Decode report bytes using the charset from Content-Type, then strip any BOM."""
        charset = None
        if "charset=" in content_type:
            charset = content_type.split("charset=", 1)[1].split(";")[0].strip()

        if charset:
            text = data.decode(charset)
        else:
            # No charset declared: don't assume UTF-8 unconditionally.
            # Try UTF-8, then fall back to Windows-1252 (cp1252).
            try:
                text = data.decode("utf-8")
            except UnicodeDecodeError:
                text = data.decode("cp1252")

        # A leading UTF-8 BOM (some listings reports) would otherwise corrupt the
        # first column header.
        return text.lstrip("\ufeff")

    @staticmethod
    def _print_report_preview(report: Dict[str, Any]) -> None:
        """Preview the parsed report based on its kind (replace with real processing)."""
        kind = report["kind"]
        if kind == "json":
            print("[Step 4] Report is JSON.")
            # for record in report["data"]: ...
        elif kind == "text":
            print("[Step 4] Report is a delimited flat file (TSV/CSV). First lines:")
            for line in report["text"].splitlines()[:5]:
                print(line)
        elif kind == "xml":
            print(f"[Step 4] Report is XML. Root tag: <{report['root'].tag}>")
            # for node in report["root"]: ...
        elif kind == "binary":
            print(
                f"[Step 4] Report is binary ({report['content_type']}, "
                f"{len(report['bytes'])} bytes). Write it to a file, e.g. untar "
                "FBA_BULK_INVOICE:"
            )
            # with open("report.bin", "wb") as f:
            #     f.write(report["bytes"])

    @staticmethod
    def _sleep_before_retry(attempt: int) -> None:
        """Back off between download retries using a simple linear-by-attempt delay."""
        time.sleep(constants.download_retry_base_delay_seconds * attempt)

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

        self.download_and_read_document(report_document_id)


# -----------------------------------------------------------------------------
# Example usage for local/manual runs (not used in unit tests)
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    recipe = RequestAndRetrieveReportRecipe()
    recipe.start()
