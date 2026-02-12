package util.notifications.datakiosk;

import com.google.gson.annotations.SerializedName;

/**
 * When a query produces results that are not included in the data document, pagination
 * occurs. This means that results are divided into pages. To retrieve the next page, you
 * must pass a `CreateQuerySpecification` object with `paginationToken` set to this object's
 * `nextToken` and with `query` set to this object's `query` in the subsequent `createQuery`
 * request. When there are no more pages to fetch, the `nextToken` field will be absent.
 */
public class Pagination {
    @SerializedName("nextToken")
    private String nextToken;

    /**
     * A token that can be used to fetch the next page of results.
     */
    public String getNextToken() {
        return nextToken;
    }

    public void setNextToken(String value) {
        this.nextToken = value;
    }
}
