package reports;

import org.w3c.dom.Document;

/**
 * Structured result of downloading and parsing a report document.
 *
 * SP-API reports are not all tab-delimited UTF-8 text: they can be delimited text (TSV/CSV),
 * JSON, XML, or binary (PDF, XLSX, a .tar.gz of PDFs, ...). This type lets the caller branch on
 * {@link #kind} instead of guessing, mirroring the structured result used by the Python recipe.
 *
 * Only the field matching {@link #kind} is populated:
 * <ul>
 *   <li>{@link Kind#TEXT} -&gt; {@link #text}</li>
 *   <li>{@link Kind#JSON} -&gt; {@link #json} (parsed with jackson-jr; a Map or List)</li>
 *   <li>{@link Kind#XML}  -&gt; {@link #xml} (a parsed DOM Document)</li>
 *   <li>{@link Kind#BINARY} -&gt; {@link #bytes} (raw, never decoded as text)</li>
 * </ul>
 */
public final class ReportContent {

    public enum Kind { TEXT, JSON, XML, BINARY }

    public final Kind kind;
    public final String contentType;

    public final String text;
    public final Object json;
    public final Document xml;
    public final byte[] bytes;

    private ReportContent(Kind kind, String contentType, String text, Object json, Document xml, byte[] bytes) {
        this.kind = kind;
        this.contentType = contentType;
        this.text = text;
        this.json = json;
        this.xml = xml;
        this.bytes = bytes;
    }

    public static ReportContent text(String contentType, String text) {
        return new ReportContent(Kind.TEXT, contentType, text, null, null, null);
    }

    public static ReportContent json(String contentType, Object json) {
        return new ReportContent(Kind.JSON, contentType, null, json, null, null);
    }

    public static ReportContent xml(String contentType, Document xml) {
        return new ReportContent(Kind.XML, contentType, null, null, xml, null);
    }

    public static ReportContent binary(String contentType, byte[] bytes) {
        return new ReportContent(Kind.BINARY, contentType, null, null, null, bytes);
    }
}
