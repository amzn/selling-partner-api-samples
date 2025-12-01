"""
Data Kiosk API Recipe: End-to-End Query Flow
=============================================

This recipe shows a simple, end-to-end Data Kiosk flow in four steps:

1. Submit a GraphQL query with `create_query`.
2. Wait for a DATA_KIOSK_QUERY_PROCESSING_FINISHED notification.
3. Use dataDocumentId or errorDocumentId with `get_document`.
4. Download and parse the document (JSON / JSONL), in memory only.

Real-world notes:
- Step 2 usually happens asynchronously (via SQS/SNS/EventBridge).
- Here we keep the logic in one class so it is easy to read and easy to test.
"""

import json
import gzip
import base64
import urllib.request
from typing import Any, Dict, Optional, Tuple

from spapi import SPAPIClient, SPAPIConfig, QueriesApi
from src.recipes.datakiosk import constants
from src.util.recipe import Recipe


class DataKioskQueryRecipe(Recipe):
    """
    A small helper class that encapsulates the Data Kiosk flow:

    * submit_query(): calls create_query and returns queryId
    * handle_notification(): inspects the notification and picks the right documentId
    * get_document_metadata(): calls get_document(document_id=...)
    * download_and_parse_document(): downloads, (optionally) decrypts, parses JSON/JSONL

    In production you would typically:
    - Call submit_query() in one component.
    - Receive the notification in another component.
    - Use handle_notification() + get_document_metadata() + download_and_parse_document() there.
    """

    def __init__(
        self,
        config: Optional[SPAPIConfig] = None,
        queries_api: Optional[QueriesApi] = None,
        graphql_query: Optional[str] = None,
        notification_body: Optional[Any] = None,
    ) -> None:
        super().__init__(config=config)
        # Allow injection of a mocked API for tests
        self._queries_api = queries_api
        self._graphql_query = graphql_query or constants.sample_query
        self._notification_body = notification_body or constants.sample_data_kiosk_notification

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    @property
    def queries_api(self) -> QueriesApi:
        if self._queries_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{constants.backend_url}/auth/o2/token",
                endpoint=constants.backend_url,
            )
            self._queries_api = QueriesApi(client.api_client)
            print("Data Kiosk Queries API client initialized successfully.")
        return self._queries_api

    # -------------------------------------------------------------------------
    # Step 1 – Create a query
    # -------------------------------------------------------------------------

    def submit_query(self) -> str:
        """
        Submit a GraphQL query to Data Kiosk using create_query.

        Returns:
            queryId (str): The ID of the query created by Data Kiosk.
        """
        body = {"query": self._graphql_query}
        response = self.queries_api.create_query(body=body)
        query_id = response.query_id
        print(f"[Step 1] Query submitted successfully. queryId = {query_id}")
        return query_id

    # -------------------------------------------------------------------------
    # Step 2 – Handle DATA_KIOSK_QUERY_PROCESSING_FINISHED notification
    # -------------------------------------------------------------------------

    def handle_notification(
        self,
        notification_body: Any,
    ) -> Tuple[str, Optional[str]]:
        """
        Parse a DATA_KIOSK_QUERY_PROCESSING_FINISHED notification and decide which
        documentId to use.

        Args:
            notification_body: Raw JSON string or dict with the notification.

        Returns:
            (status_code, document_id_or_None)
        """
        # Accept both raw JSON string and dict
        if isinstance(notification_body, str):
            try:
                notification = json.loads(notification_body)
            except json.JSONDecodeError as e:
                print(f"Invalid JSON notification: {e}")
                return "INVALID_JSON", None
        else:
            notification = notification_body

        notification_type = notification.get("notificationType")
        if notification_type != "DATA_KIOSK_QUERY_PROCESSING_FINISHED":
            print(f"Ignored wrong notificationType: {notification_type}")
            return "IGNORED_WRONG_TYPE", None

        payload = notification.get("payload", {})
        status = payload.get("processingStatus")
        data_document_id = payload.get("dataDocumentId")
        error_document_id = payload.get("errorDocumentId")
        query_id = payload.get("queryId")
        account_id = payload.get("accountId")

        print(
            f"[Step 2] Received notification for queryId={query_id}, "
            f"status={status}, accountId={account_id}"
        )

        # Your implementation uses upper-case status values: DONE / FATAL / etc.
        if status in ("PENDING", "PROCESSING", "QUEUED"):
            return f"NOT_READY ({status})", None

        if status == "FATAL":
            if error_document_id:
                print(f"Using errorDocumentId={error_document_id}")
                return "FATAL_WITH_ERROR_DOCUMENT", error_document_id
            return "FATAL_NO_ERROR_DOCUMENT", None

        if status == "DONE":
            if data_document_id:
                print(f"Using dataDocumentId={data_document_id}")
                return "DONE_WITH_DATA_DOCUMENT", data_document_id
            if error_document_id:
                print(f"Done but only errorDocumentId={error_document_id}")
                return "DONE_WITH_ERROR_DOCUMENT_ONLY", error_document_id
            return "DONE_NO_DOCUMENT", None

        return f"UNKNOWN_STATUS ({status})", None

    # -------------------------------------------------------------------------
    # Step 3 – Call get_document(document_id=...)
    # -------------------------------------------------------------------------

    def get_document_metadata(self, document_id: str) -> Dict[str, Any]:
        """
        Call get_document(document_id=...) and return the metadata as a plain dict.

        The metadata typically includes:
        - url or document_url: pre-signed URL
        - encryptionDetails: if the file is encrypted
        - compressionAlgorithm: e.g. GZIP
        """
        print(f"[Step 3] Calling get_document for document_id={document_id}")
        response = self.queries_api.get_document(document_id=document_id)

        if hasattr(response, "to_dict"):
            return response.to_dict()
        return response

    # -------------------------------------------------------------------------
    # Step 4 – Download and parse document from pre-signed URL
    # -------------------------------------------------------------------------

    def download_and_parse_document(self, document_metadata: Dict[str, Any]) -> Any:
        """
        Download the Data Kiosk document and return parsed JSON/JSONL content.

        Handles:
        - GZIP compression
        - Optional AES-GCM encryption (if encryptionDetails present)
        - JSON vs JSONL

        Returns:
            - dict for JSON documents
            - list[dict] for JSONL documents
        """
        # Different SDKs may expose the URL under different field names
        url = (
            document_metadata.get("url")
            or document_metadata.get("document_url")
        )
        if not url:
            raise RuntimeError("Document metadata does not contain a URL field.")

        print(f"[Step 4] Downloading document from: {url}")

        # Download raw bytes
        with urllib.request.urlopen(url) as response:
            data = response.read()

            # Some servers signal gzip via header
            if response.info().get("Content-Encoding") == "gzip":
                print("Detected gzip compression from HTTP headers. Decompressing…")
                data = gzip.decompress(data)

        # If the metadata indicates compression, handle it
        compression = document_metadata.get("compressionAlgorithm")
        if compression and str(compression).upper() == "GZIP":
            print("Detected compressionAlgorithm=GZIP in metadata. Decompressing…")
            data = gzip.decompress(data)

        # Handle encryption if encryptionDetails is present
        encryption_details = document_metadata.get("encryptionDetails")
        if encryption_details:
            print("Detected encryptionDetails in metadata. Decrypting…")
            data = self._decrypt_aes_gcm(data, encryption_details)

        text = data.decode("utf-8")

        # Detect JSONL vs JSON
        stripped = text.strip()
        if "\n" in stripped:
            print("Detected JSONL document. Parsing lines…")
            return [
                json.loads(line)
                for line in stripped.splitlines()
                if line.strip()
            ]

        print("Detected JSON document. Parsing…")
        return json.loads(stripped)

    # -------------------------------------------------------------------------
    # AES-GCM decryption helper (lazy import of Crypto to keep tests light)
    # -------------------------------------------------------------------------

    @staticmethod
    def _decrypt_aes_gcm(data: bytes, encryption_details: Dict[str, Any]) -> bytes:
        """
        Decrypts AES-GCM-encrypted data using details from the metadata.

        encryption_details is expected to contain:
            - key (base64)
            - initializationVector (base64)
            - authenticationTag (base64)

        This function imports pycryptodome at runtime so that tests can run
        without requiring it, unless the encrypted path is exercised.
        """
        try:
            from Crypto.Cipher import AES  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "Encrypted document but pycryptodome is not installed. "
                "Install with: pip install pycryptodome"
            ) from exc

        key_b64 = encryption_details.get("key")
        iv_b64 = encryption_details.get("initializationVector")
        tag_b64 = encryption_details.get("authenticationTag")

        if not (key_b64 and iv_b64 and tag_b64):
            raise RuntimeError("Missing fields in encryptionDetails.")

        key = base64.b64decode(key_b64)
        iv = base64.b64decode(iv_b64)
        tag = base64.b64decode(tag_b64)

        cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
        decrypted = cipher.decrypt_and_verify(data, tag)
        return decrypted

    # -------------------------------------------------------------------------
    # Main recipe entry point
    # -------------------------------------------------------------------------

    def start(self) -> None:
        """
        Main entry point showing the complete Data Kiosk flow.
        """
        query_id = self.submit_query()
        print(f"Submitted queryId={query_id}")

        status, document_id = self.handle_notification(self._notification_body)
        if not document_id:
            print(f"No documentId to fetch. Status={status}")
            return

        metadata = self.get_document_metadata(document_id)
        parsed = self.download_and_parse_document(metadata)
        print(f"Downloaded and parsed document. Status={status}")
        print("Parsed document (truncated):", str(parsed)[:500])

    # -------------------------------------------------------------------------
    # Convenience: end-to-end in one function for ad-hoc runs
    # -------------------------------------------------------------------------

    def run_with_notification(
        self,
        notification_body: Any,
        download_document: bool = True,
    ) -> Tuple[str, Optional[Dict[str, Any]], Optional[Any]]:
        """
        Convenience method to show the complete flow in one place.

        Args:
            notification_body: The DATA_KIOSK_QUERY_PROCESSING_FINISHED notification
                               (JSON string or dict).
            download_document: If False, stops after get_document_metadata().

        Returns:
            (status_code, document_metadata_or_None, parsed_document_or_None)
        """
        status, document_id = self.handle_notification(notification_body)
        if not document_id:
            print(f"[Run] No documentId to fetch. Status={status}")
            return status, None, None

        metadata = self.get_document_metadata(document_id)

        if not download_document:
            print(f"[Run] Skipping download. Returning only metadata. Status={status}")
            return status, metadata, None

        parsed = self.download_and_parse_document(metadata)
        print(f"[Run] Downloaded and parsed document. Status={status}")
        return status, metadata, parsed


# -----------------------------------------------------------------------------
# Example usage for local/manual runs (not used in unit tests)
# -----------------------------------------------------------------------------

if __name__ == "__main__":

    recipe = DataKioskQueryRecipe()
    recipe.start()
