import { ListingSubmissionResult } from "@/app/model/types";
import { MOCK_ISSUE_WITH_ATTR_NAMES } from "@/app/test-utils/mock-issue";

export const MOCK_LISTING_SUBMISSION_RESULT: ListingSubmissionResult = {
  sku: "SKU",
  submissionId: "e3ab22f3-00af-4d2a-8e78-583b9b74fea7",
  status: "ACCEPTED",
};

export const MOCK_LISTING_SUBMISSION_RESULT_WITH_ISSUES: ListingSubmissionResult =
  {
    sku: "SKU",
    submissionId: "e3ab22f3-00af-4d2a-8e78-583b9b74fea7",
    status: "INVALID",
    issues: [MOCK_ISSUE_WITH_ATTR_NAMES],
  };
