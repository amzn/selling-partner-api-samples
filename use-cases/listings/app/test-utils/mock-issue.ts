import { Issue } from "@/app/model/types";

export const MOCK_ISSUE: Issue = {
  code: "9001",
  message: "The value is invalid.",
  severity: "ERROR",
};

export const MOCK_ISSUE_WITH_ATTR_NAMES: Issue = {
  code: "9001",
  message: "The value is invalid.",
  severity: "ERROR",
  attributeNames: ["item_name", "description"],
};
