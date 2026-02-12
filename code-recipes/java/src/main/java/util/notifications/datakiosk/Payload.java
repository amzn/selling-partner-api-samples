package util.notifications.datakiosk;

import com.google.gson.annotations.SerializedName;

/**
 * The Data Kiosk query processing notification payload.
 */
public class Payload {
    @SerializedName("accountId")
    private String accountid;
    @SerializedName("dataDocumentId")
    private String dataDocumentid;
    @SerializedName("errorDocumentId")
    private String errorDocumentid;
    @SerializedName("pagination")
    private Pagination pagination;
    @SerializedName("processingStatus")
    private ProcessingStatus processingStatus;
    @SerializedName("query")
    private String query;
    @SerializedName("queryId")
    private String queryid;

    /**
     * The merchant customer identifier or vendor group identifier of the selling partner
     * account on whose behalf the query was submitted.
     */
    public String getAccountid() {
        return accountid;
    }

    public void setAccountid(String value) {
        this.accountid = value;
    }

    /**
     * The data document identifier. This document identifier is only present when there is data
     * available as a result of the query. This identifier is unique only in combination with
     * the `accountId`. Pass this identifier into the `getDocument` operation to get the
     * information required to retrieve the data document's contents.
     */
    public String getDataDocumentid() {
        return dataDocumentid;
    }

    public void setDataDocumentid(String value) {
        this.dataDocumentid = value;
    }

    /**
     * The error document identifier. This document identifier is only present when an error
     * occurs during query processing. This identifier is unique only in combination with the
     * `accountId`. Pass this identifier into the `getDocument` operation to get the information
     * required to retrieve the error document's contents.
     */
    public String getErrorDocumentid() {
        return errorDocumentid;
    }

    public void setErrorDocumentid(String value) {
        this.errorDocumentid = value;
    }

    /**
     * When a query produces results that are not included in the data document, pagination
     * occurs. This means that results are divided into pages. To retrieve the next page, you
     * must pass a `CreateQuerySpecification` object with `paginationToken` set to this object's
     * `nextToken` and with `query` set to this object's `query` in the subsequent `createQuery`
     * request. When there are no more pages to fetch, the `nextToken` field will be absent.
     */
    public Pagination getPagination() {
        return pagination;
    }

    public void setPagination(Pagination value) {
        this.pagination = value;
    }

    /**
     * The processing status of the query.
     */
    public ProcessingStatus getProcessingStatus() {
        return processingStatus;
    }

    public void setProcessingStatus(ProcessingStatus value) {
        this.processingStatus = value;
    }

    /**
     * The submitted query.
     */
    public String getQuery() {
        return query;
    }

    public void setQuery(String value) {
        this.query = value;
    }

    /**
     * The query identifier. This identifier is unique only in combination with the `accountId`.
     */
    public String getQueryid() {
        return queryid;
    }

    public void setQueryid(String value) {
        this.queryid = value;
    }
}
