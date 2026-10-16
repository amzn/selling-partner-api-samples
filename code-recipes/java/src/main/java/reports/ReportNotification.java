package reports;

/** Minimal typed view of a REPORT_PROCESSING_FINISHED notification. */
public class ReportNotification {
    public String notificationType;
    public ReportNotificationPayload payload;

    public static class ReportNotificationPayload {
        public ReportNotificationDetails reportProcessingFinishedNotification;
    }

    public static class ReportNotificationDetails {
        public String reportId;
        public String reportType;
        public String processingStatus;
        public String reportDocumentId;
    }
}
