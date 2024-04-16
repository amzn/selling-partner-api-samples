from dataclasses import dataclass
from typing import Optional


@dataclass
class Document:
    documentId: Optional[str] = None
    documentUrl: Optional[str] = None
    s3Uri: Optional[str] = None


@dataclass
class DataKioskLambdaInput:
    document: Optional[Document] = None
    queryId: Optional[str] = None
    query: Optional[str] = None
    accountId: Optional[str] = None
    processingStatus: Optional[str] = None

    def __post_init__(self):
        if isinstance(self.document, dict):
            self.document = Document(**self.document)
