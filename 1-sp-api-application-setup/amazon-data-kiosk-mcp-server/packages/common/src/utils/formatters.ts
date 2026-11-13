// src/utils/formatters.ts

/**
 * Formats a query status response into human-readable text
 * @param result The query status API response
 * @returns Formatted status message
 */
export function formatQueryStatus(result: any): string {
  // Log the complete response for debugging
  console.error("API Response:", JSON.stringify(result, null, 2));
  
  // Try multiple possible paths for status as seen in the original implementation
  const status = result.processingStatus || result.status || 
                (result.results && result.results.processingStatus) || "UNKNOWN";
  
  let responseText = `Query Status: ${status}\n`;
  
  // Handle different processing statuses
  switch(status) {
    case "DONE":
      responseText += `\nQuery completed successfully at ${result.processingEndTime}\n`;
      
      // Check for data document
      if (result.dataDocumentId) {
        responseText += `\nDocument ID: ${result.dataDocumentId}\n`;
        responseText += `\nUse the 'get-document-details' tool with this Document ID to get download information.`;
      } else {
        responseText += `\nNo data document was generated. This could be due to no data matching your query criteria.`;
      }
      break;
      
    case "FATAL":
      responseText += `\nQuery failed with errors at ${result.processingEndTime}\n`;
      
      // Check for error document
      if (result.errorDocumentId) {
        responseText += `\nError Document ID: ${result.errorDocumentId}\n`;
        responseText += `\nUse the 'get-document-details' tool with this Error Document ID to get error details.`;
      } else {
        responseText += `\nNo error document was provided.`;
      }
      break;
      
    case "CANCELLED":
      responseText += `\nQuery was cancelled. If you didn't cancel it, it may have been cancelled automatically due to system constraints.`;
      break;
      
    case "IN_PROGRESS":
      responseText += `\nThe query is currently being processed. It started at ${result.processingStartTime}.\n`;
      responseText += `\nPlease check again in a few moments.`;
      break;
      
    case "IN_QUEUE":
      responseText += `\nThe query is waiting in the queue to be processed.\n`;
      responseText += `\nPlease check again in a few moments.`;
      break;
      
    case "UNKNOWN":
      // This might happen if the API response structure is different than expected
      responseText = `Query status could not be determined.\n`;
      
      // Check if we have a documentId regardless of status
      if (result.documentId || (result.results && result.results.documentId)) {
        const docId = result.documentId || (result.results && result.results.documentId);
        responseText += `\nDocument ID: ${docId}\n`;
        responseText += `\nUse the 'get-document-details' tool with this Document ID to get download information.`;
      } else {
        responseText += `\nThe query is still processing or the API returned an unexpected format. Check again in a few moments.`;
      }
      break;
      
    default:
      responseText += `\nUnexpected status: ${status}. Please check again in a few moments or contact support if this persists.`;
  }
  
  // Check for pagination
  if (result.pagination && result.pagination.nextToken) {
    responseText += `\n\nAdditional data is available. To retrieve the next page of results, use the 'create-query' tool with:`;
    responseText += `\n- The same query: ${result.query?.substring(0, 100) || "Not available"}...`;
    responseText += `\n- Pagination token: ${result.pagination.nextToken}`;
  }
  
  // Include a summary of the query details
  responseText += `\n\nQuery Details:`;
  responseText += `\n- Query ID: ${result.queryId || "Not available"}`;
  responseText += `\n- Created: ${result.createdTime || "Not available"}`;
  if (result.processingStartTime) {
    responseText += `\n- Processing Started: ${result.processingStartTime}`;
  }
  if (result.processingEndTime) {
    responseText += `\n- Processing Ended: ${result.processingEndTime}`;
  }
  
  return responseText;
}

/**
 * Formats document content from JSONL to a more readable format
 * @param content The document content in JSONL format
 * @returns Formatted content
 */
export function formatDocumentContent(content: string): string {
  // Process JSONL to a more readable format
  // JSONL format has one JSON object per line
  const lines = content.trim().split('\n');
  try {
    const parsedContent = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return line;
      }
    });
    
    return JSON.stringify(parsedContent, null, 2).substring(0, 5000) + 
           (content.length > 5000 ? "...(truncated)" : "");
  } catch (error) {
    console.error("Error formatting document content:", error);
    return content.substring(0, 5000) + (content.length > 5000 ? "...(truncated)" : "");
  }
}

/**
 * Creates a user-friendly error message based on the error
 * @param error The error object or message
 * @param context Additional context information
 * @returns Formatted error message
 */
export function formatErrorMessage(error: any, context?: string): string {
  const errorString = String(error);
  let errorMessage = `Error${context ? ` ${context}` : ''}: ${errorString}`;
  
  // Check for common error types
  if (errorString.includes("404")) {
    errorMessage = `The requested resource was not found. Please verify the ID is correct and that the resource hasn't been deleted due to retention policies.`;
  } else if (errorString.includes("403")) {
    errorMessage = `Authorization error. Please check your authentication credentials.`;
  } else if (errorString.includes("400")) {
    errorMessage = `Invalid request. Please check your query parameters.`;
  } else if (errorString.includes("429")) {
    errorMessage = `Rate limit exceeded. Please wait a moment before trying again.`;
  }
  
  return errorMessage;
}