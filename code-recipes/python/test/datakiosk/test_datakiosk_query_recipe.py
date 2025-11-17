import json
from unittest.mock import MagicMock

import pytest

from src.recipes.datakiosk.datakiosk_query_recipe import DataKioskQueryRecipe

# ---------------------------------------------------------------------------
# How to Test?
# ---------------------------------------------------------------------------

# pip install pytest
# cd code-recipes/python
# pytest test/datakiosk/test_datakiosk_query_recipe.py -q

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_notification(
    notification_type="DATA_KIOSK_QUERY_PROCESSING_FINISHED",
    processing_status="DONE",
    data_document_id=None,
    error_document_id=None,
    query_id="Q123",
    account_id="A123",
):
    return {
        "notificationType": notification_type,
        "payload": {
            "processingStatus": processing_status,
            "dataDocumentId": data_document_id,
            "errorDocumentId": error_document_id,
            "queryId": query_id,
            "accountId": account_id,
        },
    }


# ---------------------------------------------------------------------------
# submit_query
# ---------------------------------------------------------------------------

class FakeCreateQueryResponse:
    def __init__(self, query_id: str):
        self.query_id = query_id


def test_submit_query_uses_queries_api_and_returns_query_id():
    # Arrange
    fake_queries_api = type("FakeQueriesApi", (), {})()
    fake_queries_api.create_query = MagicMock(
        return_value=FakeCreateQueryResponse("TEST_QUERY_ID")
    )

    recipe = DataKioskQueryRecipe(
        queries_api=fake_queries_api,
        graphql_query="query MyTestQuery { ping }",
    )

    # Act
    query_id = recipe.submit_query()

    # Assert
    fake_queries_api.create_query.assert_called_once_with(
        body={"query": "query MyTestQuery { ping }"}
    )
    assert query_id == "TEST_QUERY_ID"


# ---------------------------------------------------------------------------
# handle_notification
# ---------------------------------------------------------------------------

def test_handle_notification_ignored_wrong_type():
    recipe = DataKioskQueryRecipe(queries_api=MagicMock())

    notif = make_notification(notification_type="SOME_OTHER_TYPE")

    status, doc_id = recipe.handle_notification(notif)

    assert status == "IGNORED_WRONG_TYPE"
    assert doc_id is None


def test_handle_notification_not_ready():
    recipe = DataKioskQueryRecipe(queries_api=MagicMock())

    notif = make_notification(processing_status="PROCESSING")

    status, doc_id = recipe.handle_notification(notif)

    assert status == "NOT_READY (PROCESSING)"
    assert doc_id is None


def test_handle_notification_done_with_data_document():
    recipe = DataKioskQueryRecipe(queries_api=MagicMock())

    notif = make_notification(
        processing_status="DONE",
        data_document_id="DOC_DATA_123",
        error_document_id=None,
        query_id="Q456",
        account_id="A789",
    )

    status, doc_id = recipe.handle_notification(notif)

    assert status == "DONE_WITH_DATA_DOCUMENT"
    assert doc_id == "DOC_DATA_123"


def test_handle_notification_fatal_with_error_document():
    recipe = DataKioskQueryRecipe(queries_api=MagicMock())

    notif = make_notification(
        processing_status="FATAL",
        data_document_id=None,
        error_document_id="DOC_ERR_999",
    )

    status, doc_id = recipe.handle_notification(notif)

    assert status == "FATAL_WITH_ERROR_DOCUMENT"
    assert doc_id == "DOC_ERR_999"


def test_handle_notification_done_no_documents():
    recipe = DataKioskQueryRecipe(queries_api=MagicMock())

    notif = make_notification(
        processing_status="DONE",
        data_document_id=None,
        error_document_id=None,
    )

    status, doc_id = recipe.handle_notification(notif)

    assert status == "DONE_NO_DOCUMENT"
    assert doc_id is None


# ---------------------------------------------------------------------------
# get_document_metadata
# ---------------------------------------------------------------------------

class FakeGetDocumentResponse:
    def __init__(self, data: dict):
        self._data = data

    def to_dict(self):
        return self._data


def test_get_document_metadata_calls_get_document_and_returns_dict():
    # Arrange
    fake_response_data = {"documentId": "DOC123", "url": "https://example.com/doc"}
    fake_response = FakeGetDocumentResponse(fake_response_data)

    fake_queries_api = type("FakeQueriesApi", (), {})()
    fake_queries_api.get_document = MagicMock(return_value=fake_response)

    recipe = DataKioskQueryRecipe(queries_api=fake_queries_api)

    # Act
    metadata = recipe.get_document_metadata("DOC123")

    # Assert
    fake_queries_api.get_document.assert_called_once_with(document_id="DOC123")
    assert metadata == fake_response_data


# ---------------------------------------------------------------------------
# download_and_parse_document – JSON + JSONL
# ---------------------------------------------------------------------------

class FakeHeaders:
    def __init__(self, headers):
        self._headers = headers

    def get(self, key, default=None):
        return self._headers.get(key, default)


class FakeResponse:
    def __init__(self, data: bytes, headers=None):
        self._data = data
        self._headers = headers or {}

    def read(self) -> bytes:
        return self._data

    def info(self):
        return FakeHeaders(self._headers)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass


def test_download_and_parse_document_json(monkeypatch):
    # Arrange
    recipe = DataKioskQueryRecipe(queries_api=MagicMock())

    metadata = {"documentId": "DOC_JSON", "url": "https://example.com/json"}

    json_bytes = b'{"foo": "bar", "answer": 42}'

    def fake_urlopen(url):
        assert url == "https://example.com/json"
        return FakeResponse(json_bytes)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # Act
    parsed = recipe.download_and_parse_document(metadata)

    # Assert
    assert isinstance(parsed, dict)
    assert parsed["foo"] == "bar"
    assert parsed["answer"] == 42


def test_download_and_parse_document_jsonl(monkeypatch):
    # Arrange
    recipe = DataKioskQueryRecipe(queries_api=MagicMock())

    metadata = {"documentId": "DOC_JSONL", "url": "https://example.com/jsonl"}

    jsonl_text = "\n".join(
        [
            json.dumps({"row": 1, "value": "a"}),
            json.dumps({"row": 2, "value": "b"}),
            "",
        ]
    )
    jsonl_bytes = jsonl_text.encode("utf-8")

    def fake_urlopen(url):
        assert url == "https://example.com/jsonl"
        return FakeResponse(jsonl_bytes)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # Act
    parsed = recipe.download_and_parse_document(metadata)

    # Assert
    assert isinstance(parsed, list)
    assert parsed[0]["row"] == 1
    assert parsed[1]["value"] == "b"


def test_download_and_parse_document_uses_document_url_fallback(monkeypatch):
    # Arrange
    recipe = DataKioskQueryRecipe(queries_api=MagicMock())

    metadata = {"documentId": "DOC_JSON", "document_url": "https://example.com/json-fallback"}

    json_bytes = b'{"foo": "baz"}'

    def fake_urlopen(url):
        assert url == "https://example.com/json-fallback"
        return FakeResponse(json_bytes)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    # Act
    parsed = recipe.download_and_parse_document(metadata)

    # Assert
    assert parsed["foo"] == "baz"


# ---------------------------------------------------------------------------
# run_with_notification – end-to-end (mocked)
# ---------------------------------------------------------------------------

def test_run_with_notification_happy_path(monkeypatch):
    # Arrange
    fake_queries_api = MagicMock()
    recipe = DataKioskQueryRecipe(queries_api=fake_queries_api)

    notification = make_notification(
        processing_status="DONE",
        data_document_id="DOC_DATA_123",
    )

    fake_metadata = {"documentId": "DOC_DATA_123", "url": "https://example.com/doc"}
    fake_parsed = [{"some": "row"}]

    # Patch instance methods to avoid real network calls
    monkeypatch.setattr(recipe, "get_document_metadata", MagicMock(return_value=fake_metadata))
    monkeypatch.setattr(recipe, "download_and_parse_document", MagicMock(return_value=fake_parsed))

    # Act
    status, metadata, parsed = recipe.run_with_notification(notification)

    # Assert
    assert status == "DONE_WITH_DATA_DOCUMENT"
    recipe.get_document_metadata.assert_called_once_with("DOC_DATA_123")
    recipe.download_and_parse_document.assert_called_once_with(fake_metadata)
    assert metadata == fake_metadata
    assert parsed == fake_parsed


def test_run_with_notification_no_document_id():
    # If status is NOT_READY, run_with_notification should not try to fetch a document
    fake_queries_api = MagicMock()
    recipe = DataKioskQueryRecipe(queries_api=fake_queries_api)

    notification = make_notification(processing_status="PROCESSING")

    status, metadata, parsed = recipe.run_with_notification(notification)

    assert status == "NOT_READY (PROCESSING)"
    assert metadata is None
    assert parsed is None
