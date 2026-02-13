package util.notifications.datakiosk;

import com.google.gson.annotations.SerializedName;

/**
 * The processing status of the query.
 */
public enum ProcessingStatus {
    @SerializedName("CANCELLED")
    CANCELLED,
    
    @SerializedName("DONE")
    DONE,
    
    @SerializedName("FATAL")
    FATAL
}
