<?php

namespace Src\reports;

/**
 * Structured result of downloading and parsing a report document.
 *
 * SP-API reports are not all tab-delimited UTF-8 text: they can be delimited text (TSV/CSV),
 * JSON, XML, or binary (PDF, XLSX, a .tar.gz of PDFs, ...). This type lets the caller branch on
 * the kind instead of guessing, mirroring the structured result used by the Python recipe.
 *
 * Only the payload matching the kind is populated:
 * - KIND_TEXT   -> getText(): string
 * - KIND_JSON   -> getData(): mixed (associative array / list, from json_decode)
 * - KIND_XML    -> getXml(): \SimpleXMLElement
 * - KIND_BINARY -> getBytes(): string (raw bytes, never decoded as text)
 */
class ReportContent
{
    public const string KIND_TEXT = "text";
    public const string KIND_JSON = "json";
    public const string KIND_XML = "xml";
    public const string KIND_BINARY = "binary";

    private function __construct(
        private readonly string $kind,
        private readonly string $contentType,
        private readonly mixed $payload
    ) {
    }

    public static function text(string $contentType, string $text): self
    {
        return new self(self::KIND_TEXT, $contentType, $text);
    }

    public static function json(string $contentType, mixed $data): self
    {
        return new self(self::KIND_JSON, $contentType, $data);
    }

    public static function xml(string $contentType, \SimpleXMLElement $xml): self
    {
        return new self(self::KIND_XML, $contentType, $xml);
    }

    public static function binary(string $contentType, string $bytes): self
    {
        return new self(self::KIND_BINARY, $contentType, $bytes);
    }

    public function getKind(): string
    {
        return $this->kind;
    }

    public function getContentType(): string
    {
        return $this->contentType;
    }

    public function getText(): string
    {
        return (string)$this->payload;
    }

    public function getData(): mixed
    {
        return $this->payload;
    }

    public function getXml(): \SimpleXMLElement
    {
        return $this->payload;
    }

    public function getBytes(): string
    {
        return (string)$this->payload;
    }
}
