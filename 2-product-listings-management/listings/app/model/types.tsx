import { Subscription as SDKSubscription } from "@/app/sdk/notifications";

/**
 * The Issue returned from the Listing API.
 */
export interface Issue {
  code: string;
  message: string;
  severity: string;
  attributeNames?: string[];
}

/**
 * The result of the Listings Items API submission.
 */
export interface ListingSubmissionResult {
  sku: string;
  status: string;
  submissionId: string;
  issues?: Issue[];
}

/**
 * Relevant information from Listings GET API call.
 */
export interface Listing {
  attributes: object;
  issues?: Issue[];
  productType?: string;
}

/**
 * A type which represents a patch for the contribution.
 */
export interface Patch {
  op: string;
  path: string;
  value: any;
}

/**
 * A type for the alert dialog state.
 */
export interface AlertDialogState {
  showAlert: boolean;
  alertTitle: string;
  alertContent: string;
}

/**
 * A type which captures the SP API request and response.
 */
export interface SPAPIRequestResponse {
  apiName: string;
  apiDocumentationLink: string;
  request: object;
  response: object;
}

/**
 * A type which capture the information about a feed.
 */
export interface Feed {
  feedId: string;
  feedType: string;
  createdTime: string;
  processingStatus: string;
  resultFeedDocumentId: string;
}

/**
 * A type which capture the information about a Subscription.
 */
export interface Subscription {
  notificationType: string;
  eventBusName?: string;
  eventBusFilterRule?: string;
  sqsTargetId?: string;
  sqsQueueName?: string;
  subscriptionId: string;
}

/**
 * A type which captures the raw SDK subscription along with the
 * notification type.
 */
export interface RawSubscription {
  notificationType: string;
  subscription: SDKSubscription;
}
