import type {
  DetectionStrategy,
  Finding,
  SupportedLanguage,
  CodeLocation,
} from "./types.js";
import {
  pollingPatterns,
  errorHandlingPatterns,
  retryPatterns,
  rateLimitPatterns,
  batchMappings,
  reportAlternatives,
  notificationTypes,
  deprecatedApiPatterns,
  modernClassIndicators,
  v0ClassPatternNames,
} from "./language-patterns.js";

// ── Helpers ───────────────────────────────────────────────────────

function getLineNumber(source: string, index: number): number {
  return source.substring(0, index).split("\n").length;
}

function getContext(source: string, index: number, _length: number): string {
  const lines = source.split("\n");
  const lineIndex = getLineNumber(source, index) - 1;
  const line = lines[lineIndex] ?? "";
  return line.trim();
}

function makeLocation(
  source: string,
  index: number,
  length: number,
): CodeLocation {
  return {
    line: getLineNumber(source, index),
    context: getContext(source, index, length),
  };
}

function matchesSection(entrySection: string, filterSection?: string): boolean {
  if (!filterSection) return true;
  return entrySection.toLowerCase() === filterSection.toLowerCase();
}

function hasPatternNearby(
  source: string,
  index: number,
  patterns: Array<{ pattern: RegExp }>,
  range = 300,
): boolean {
  const start = Math.max(0, index - range);
  const end = Math.min(source.length, index + range);
  const context = source.substring(start, end);
  return patterns.some((p) => p.pattern.test(context));
}

/**
 * Returns true if the character at `index` falls inside a comment.
 * Handles single-line (//, #) and multi-line block comments,
 * as well as JSDoc and Python docstrings.
 */
function isInsideComment(source: string, index: number): boolean {
  const lines = source.split("\n");
  const lineIndex = getLineNumber(source, index) - 1;
  const line = lines[lineIndex] ?? "";
  const trimmed = line.trimStart();

  // Single-line comments: // (JS/Java/C#/PHP), # (Python/PHP)
  // Block-comment continuation lines: * ... (JSDoc/Javadoc/PHPDoc)
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*")
  ) {
    return true;
  }

  // Check if we're inside a multi-line block comment /* ... */ (JS/Java/C#/PHP)
  const textBefore = source.substring(0, index);
  const lastBlockOpen = textBefore.lastIndexOf("/*");
  if (lastBlockOpen !== -1) {
    const lastBlockClose = textBefore.lastIndexOf("*/");
    if (lastBlockClose < lastBlockOpen) {
      return true;
    }
  }

  // Check if we're inside a Python triple-quote docstring (""" or ''')
  const tripleDoubleCount = (textBefore.match(/"""/g) || []).length;
  if (tripleDoubleCount % 2 !== 0) return true;
  const tripleSingleCount = (textBefore.match(/'''/g) || []).length;
  if (tripleSingleCount % 2 !== 0) return true;

  return false;
}

// ── 1. Call Reduction (removed — overlaps with BatchingStrategy and produces
//    false positives on legitimate loop patterns in SDK-based code) ─────────

// ── 2. Batching ───────────────────────────────────────────────────

export class BatchingStrategy implements DetectionStrategy {
  readonly category = "batching" as const;

  detect(
    sourceCode: string,
    _language: SupportedLanguage | "agnostic",
    apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];
    for (const mapping of batchMappings) {
      if (!matchesSection(mapping.apiSection, apiSection)) continue;
      const regex = new RegExp(`\\b${mapping.individual}\\b`, "g");
      let match: RegExpExecArray | null;
      while ((match = regex.exec(sourceCode)) !== null) {
        if (isInsideComment(sourceCode, match.index)) continue;
        // Only flag when the call is inside a loop — that's the actual anti-pattern.
        // A standalone call to an individual operation is perfectly fine.
        if (!this.isInsideLoop(sourceCode, match.index)) continue;
        findings.push({
          severity: "MEDIUM",
          category: this.category,
          issue: `Individual operation '${mapping.individual}' called in a loop — consider using batch equivalent '${mapping.batch}'`,
          current_pattern: `Using ${mapping.individual} in a loop for multiple items`,
          impact: `Switch to '${mapping.batch}' to reduce API call volume and lower throttling risk`,
          location: makeLocation(sourceCode, match.index, match[0].length),
        });
      }
    }
    return findings;
  }

  /**
   * Checks whether the character at `index` is inside a loop construct
   * (for, while, forEach, map) by scanning backwards for loop keywords.
   */
  private isInsideLoop(source: string, index: number): boolean {
    const preceding = source.substring(Math.max(0, index - 1500), index);
    // JS/Java/C#/PHP: for(...), while(...), .forEach(...), .map(...)
    // C#: foreach(...), .Select(...)
    // Python: for x in ...:
    // PHP: foreach(...), array_map(...)
    // Java: .stream().map(...)
    return /(?:for\s*\(|for\s+\w+\s+in\s|while\s*\(|while\s+|foreach\s*\(|\.forEach\s*\(|\.map\s*\(|\.Select\s*\(|array_map\s*\(|\.stream\s*\(\))/.test(
      preceding,
    );
  }
}

// ── 3. Notification ───────────────────────────────────────────────

export class NotificationStrategy implements DetectionStrategy {
  readonly category = "notifications" as const;

  detect(
    sourceCode: string,
    _language: SupportedLanguage | "agnostic",
    apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];
    const hasPolling = pollingPatterns.some((p) => p.pattern.test(sourceCode));
    if (!hasPolling) return findings;

    for (const notif of notificationTypes) {
      if (!matchesSection(notif.apiSection, apiSection)) continue;
      // Check if the code references this API section's endpoints
      const sectionPattern = new RegExp(
        notif.apiSection.replace(/\s+/g, "[\\s_-]*"),
        "i",
      );
      if (sectionPattern.test(sourceCode)) {
        // Find the polling pattern location
        for (const pp of pollingPatterns) {
          const match = pp.pattern.exec(sourceCode);
          if (match) {
            findings.push({
              severity: "LOW",
              category: this.category,
              issue: `Polling pattern detected for ${notif.apiSection} — push notification '${notif.type}' is available`,
              current_pattern: pp.description,
              impact: notif.description,
              location: makeLocation(sourceCode, match.index, match[0].length),
            });
            break;
          }
        }
      }
    }
    return findings;
  }
}

// ── 4. Caching ────────────────────────────────────────────────────

export class CachingStrategy implements DetectionStrategy {
  readonly category = "caching" as const;

  private static readonly cacheCandidates = [
    {
      pattern:
        /\b(?:getMarketplaceParticipations|GetMarketplaceParticipations|get_marketplace_participations)\b/g,
      description:
        "Marketplace participations rarely change — consider caching (TTL: 24h+)",
    },
    {
      pattern: /\b(?:getCatalogItem|GetCatalogItem|get_catalog_item)\b/g,
      description:
        "Catalog item data is relatively static — consider caching (TTL: 1h+)",
    },
    {
      pattern:
        /\b(?:getMyFeesEstimate|GetMyFeesEstimate|get_my_fees_estimate)\b/g,
      description:
        "Fee estimates change infrequently — consider caching (TTL: 1h)",
    },
    {
      pattern:
        /\b(?:getCompetitivePricing|GetCompetitivePricing|get_competitive_pricing)\b/g,
      description:
        "Competitive pricing data can be cached with a short TTL (TTL: 5-15min)",
    },
    {
      pattern:
        /\b(?:getDefinitionsProductType|GetDefinitionsProductType|get_definitions_product_type)\b/g,
      description:
        "Product type schemas rarely change — consider caching (TTL: 24h+)",
    },
    {
      pattern:
        /\b(?:getListingsRestrictions|GetListingsRestrictions|get_listings_restrictions)\b/g,
      description:
        "Listings restrictions per ASIN/marketplace change infrequently — consider caching (TTL: 12h+)",
    },
    {
      pattern: /\b(?:getAccount|GetAccount|get_account)\b/g,
      description:
        "Seller account info is very static — consider caching (TTL: 24h+)",
    },
    {
      pattern:
        /\b(?:createRestrictedDataToken|CreateRestrictedDataToken|create_restricted_data_token)\b/g,
      description:
        "RDTs are valid for 1 hour — cache and reuse until expiry instead of requesting per call (TTL: 1h)",
    },
  ];

  detect(
    sourceCode: string,
    _language: SupportedLanguage | "agnostic",
    _apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];
    const cachePatterns = /\bcache\b|Cache|memoize|ttl|TTL/i;
    const hasCache = cachePatterns.test(sourceCode);
    if (hasCache) return findings; // Code already uses caching

    for (const candidate of CachingStrategy.cacheCandidates) {
      let match: RegExpExecArray | null;
      while ((match = candidate.pattern.exec(sourceCode)) !== null) {
        if (isInsideComment(sourceCode, match.index)) continue;
        findings.push({
          severity: "LOW",
          category: this.category,
          issue: candidate.description,
          current_pattern: `Calling ${match[0]} without caching`,
          impact: "Unnecessary API calls for data that changes infrequently",
          location: makeLocation(sourceCode, match.index, match[0].length),
        });
      }
    }
    return findings;
  }
}

// ── 5. Pagination ─────────────────────────────────────────────────

export class PaginationStrategy implements DetectionStrategy {
  readonly category = "pagination" as const;

  detect(
    sourceCode: string,
    _language: SupportedLanguage | "agnostic",
    _apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];
    // Detect list/search operations without nextToken handling
    // Matches camelCase (JS/Java/PHP), PascalCase (C#), and snake_case (Python)
    const listOps =
      /\b(?:getOrders|GetOrders|get_orders|searchOrders|SearchOrders|search_orders|searchCatalogItems|SearchCatalogItems|search_catalog_items|listInboundPlans|ListInboundPlans|list_inbound_plans|getFeeds|GetFeeds|get_feeds|getReports|GetReports|get_reports|listFinancialEvents|ListFinancialEvents|list_financial_events)\b/g;
    let match: RegExpExecArray | null;
    while ((match = listOps.exec(sourceCode)) !== null) {
      if (isInsideComment(sourceCode, match.index)) continue;
      const hasNextToken =
        /nextToken|NextToken|next_token|paginationToken|PaginationToken|pagination_token/i.test(
          sourceCode,
        );
      if (!hasNextToken) {
        findings.push({
          severity: "MEDIUM",
          category: this.category,
          issue: `Paginated operation '${match[0]}' detected without pagination handling`,
          current_pattern: `Calling ${match[0]} without nextToken/paginationToken processing`,
          impact: "May miss data beyond the first page of results",
          location: makeLocation(sourceCode, match.index, match[0].length),
        });
        break; // One finding is enough for missing pagination
      }
    }
    return findings;
  }
}

// ── 6. Scheduling ─────────────────────────────────────────────────

export class SchedulingStrategy implements DetectionStrategy {
  readonly category = "scheduling" as const;

  detect(
    sourceCode: string,
    _language: SupportedLanguage | "agnostic",
    _apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];
    let match: RegExpExecArray | null;

    // Strategy 1: Detect setInterval/setTimeout with a short numeric interval (JS/PHP).
    // Matches the closing pattern  }, NUMBER);  and confirms a setInterval
    // exists in the preceding code. Works regardless of callback body length.
    const intervalEndPattern = /\}\s*,\s*(\d+)\s*\)\s*;/g;
    while ((match = intervalEndPattern.exec(sourceCode)) !== null) {
      const ms = parseInt(match[1], 10);
      if (ms < 60000) {
        const precedingCode = sourceCode.substring(
          Math.max(0, match.index - 3000),
          match.index,
        );
        if (/setInterval\s*\(/i.test(precedingCode)) {
          findings.push({
            severity: "CRITICAL",
            category: this.category,
            issue: `High-frequency polling interval detected (${ms}ms) — likely to trigger rate limits`,
            current_pattern: `setInterval with ${ms}ms delay`,
            impact:
              "Rapid polling generates excessive API calls and risks 429 throttling",
            location: makeLocation(sourceCode, match.index, match[0].length),
          });
        }
      }
    }

    // Strategy 2: Detect short sleep/delay inside loops across all languages.
    // JS/PHP: sleep(ms), delay(ms), await sleep(500)
    // Java: Thread.sleep(ms)
    // C#: Thread.Sleep(ms), Task.Delay(ms)
    // Python: time.sleep(s), asyncio.sleep(s)
    const loopWithDelayPattern =
      /(?:for\s*\(|for\s+\w+\s+in\s|while\s*\(|while\s+|foreach\s*\(|\.forEach\s*\(|\.each\s*\()[\s\S]{0,500}?(?:await\s+)?(?:this\.)?(?:sleep|delay|Thread\.sleep|Thread\.Sleep|Task\.Delay|time\.sleep|asyncio\.sleep)\s*\(\s*(\d+)\s*\)/g;
    while ((match = loopWithDelayPattern.exec(sourceCode)) !== null) {
      const value = parseInt(match[1], 10);
      // Python time.sleep uses seconds, others use milliseconds
      const isPythonSleep = /time\.sleep|asyncio\.sleep/.test(match[0]);
      const ms = isPythonSleep ? value * 1000 : value;
      if (ms < 1000) {
        findings.push({
          severity: "CRITICAL",
          category: this.category,
          issue: `Short delay (${isPythonSleep ? value + "s" : ms + "ms"}) in loop — likely to trigger rate limits if making API calls`,
          current_pattern: `Loop with ${isPythonSleep ? value + "s" : ms + "ms"} delay between iterations`,
          impact:
            "Insufficient delay between API calls risks 429 throttling. Use at least 1000ms delay.",
          location: makeLocation(sourceCode, match.index, match[0].length),
        });
      }
    }

    // Strategy 3: Detect Java/C# scheduled executors with short intervals
    const scheduledPattern =
      /scheduleAtFixedRate\s*\([^,]+,\s*\d+\s*,\s*(\d+)\s*,\s*TimeUnit\.(\w+)/g;
    while ((match = scheduledPattern.exec(sourceCode)) !== null) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toUpperCase();
      const ms =
        unit === "SECONDS"
          ? value * 1000
          : unit === "MILLISECONDS"
            ? value
            : value * 60000;
      if (ms < 60000) {
        findings.push({
          severity: "CRITICAL",
          category: this.category,
          issue: `High-frequency scheduled task detected (${value} ${unit.toLowerCase()}) — likely to trigger rate limits`,
          current_pattern: `scheduleAtFixedRate with ${value} ${unit.toLowerCase()} interval`,
          impact:
            "Rapid polling generates excessive API calls and risks 429 throttling",
          location: makeLocation(sourceCode, match.index, match[0].length),
        });
      }
    }

    return findings;
  }
}

// ── 7. Reports ────────────────────────────────────────────────────

export class ReportsStrategy implements DetectionStrategy {
  readonly category = "reports" as const;

  detect(
    sourceCode: string,
    _language: SupportedLanguage | "agnostic",
    apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];
    for (const report of reportAlternatives) {
      if (!matchesSection(report.apiSection, apiSection)) continue;
      for (const op of report.replacesOperations) {
        const regex = new RegExp(`\\b${op}\\b`, "g");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(sourceCode)) !== null) {
          if (isInsideComment(sourceCode, match.index)) continue;
          findings.push({
            severity: "LOW",
            category: this.category,
            issue: `'${op}' can be replaced by the '${report.reportType}' report for bulk data retrieval`,
            current_pattern: `Using ${op} for data that could be retrieved via report`,
            impact: report.description,
            location: makeLocation(sourceCode, match.index, match[0].length),
          });
        }
      }
    }
    return findings;
  }
}

// ── 8. Error Handling ─────────────────────────────────────────────

export class ErrorHandlingStrategy implements DetectionStrategy {
  readonly category = "error_handling" as const;

  detect(
    sourceCode: string,
    _language: SupportedLanguage | "agnostic",
    _apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];
    // Find SP-API call sites and check for nearby error handling
    // Matches camelCase (JS/Java/PHP), PascalCase (C#), and snake_case (Python)
    const apiCallPattern =
      /\b(?:getOrder|GetOrder|get_order|searchOrders|SearchOrders|search_orders|getCatalogItem|GetCatalogItem|get_catalog_item|searchCatalogItems|SearchCatalogItems|search_catalog_items|getListingsItem|GetListingsItem|get_listings_item|createFeed|CreateFeed|create_feed|getReport|GetReport|get_report|getInventorySummaries|GetInventorySummaries|get_inventory_summaries|listInboundPlans|ListInboundPlans|list_inbound_plans|getMarketplaceParticipations|GetMarketplaceParticipations|get_marketplace_participations)\b/g;
    let match: RegExpExecArray | null;
    while ((match = apiCallPattern.exec(sourceCode)) !== null) {
      if (isInsideComment(sourceCode, match.index)) continue;
      if (!hasPatternNearby(sourceCode, match.index, errorHandlingPatterns)) {
        findings.push({
          severity: "HIGH",
          category: this.category,
          issue: `API call '${match[0]}' detected without error handling nearby`,
          current_pattern: `${match[0]} called without try/catch or .catch()`,
          impact:
            "Unhandled API errors can crash the application or cause silent failures",
          location: makeLocation(sourceCode, match.index, match[0].length),
        });
      }
    }
    return findings;
  }
}

// ── 9. Rate Limiting ──────────────────────────────────────────────

export class RateLimitingStrategy implements DetectionStrategy {
  readonly category = "rate_limiting" as const;

  detect(
    sourceCode: string,
    _language: SupportedLanguage | "agnostic",
    _apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];
    // Collect all distinct SP-API operations found in code (not in comments)
    // Matches camelCase (JS/Java/PHP), PascalCase (C#), and snake_case (Python)
    const apiOpsPattern =
      /\b(getOrder|GetOrder|get_order|searchOrders|SearchOrders|search_orders|getCatalogItem|GetCatalogItem|get_catalog_item|searchCatalogItems|SearchCatalogItems|search_catalog_items|getListingsItem|GetListingsItem|get_listings_item|createFeed|CreateFeed|create_feed|getReport|GetReport|get_report|getInventorySummaries|GetInventorySummaries|get_inventory_summaries|listInboundPlans|ListInboundPlans|list_inbound_plans)\b/g;
    const foundOps = new Set<string>();
    let scanMatch: RegExpExecArray | null;
    while ((scanMatch = apiOpsPattern.exec(sourceCode)) !== null) {
      if (!isInsideComment(sourceCode, scanMatch.index)) {
        foundOps.add(scanMatch[1]);
      }
    }
    if (foundOps.size === 0) return findings;

    const hasRateLimitHandling = rateLimitPatterns.some((p) =>
      p.pattern.test(sourceCode),
    );
    const hasRetryLogic = retryPatterns.some((p) => p.pattern.test(sourceCode));

    if (!hasRateLimitHandling && !hasRetryLogic) {
      // Find the first non-comment API call to anchor the finding
      const firstCallPattern =
        /\b(?:getOrder|GetOrder|get_order|searchOrders|SearchOrders|search_orders|getCatalogItem|GetCatalogItem|get_catalog_item|searchCatalogItems|SearchCatalogItems|search_catalog_items|getListingsItem|GetListingsItem|get_listings_item|createFeed|CreateFeed|create_feed|getReport|GetReport|get_report|getInventorySummaries|GetInventorySummaries|get_inventory_summaries|listInboundPlans|ListInboundPlans|list_inbound_plans)\b/g;
      let firstCall: RegExpExecArray | null;
      while ((firstCall = firstCallPattern.exec(sourceCode)) !== null) {
        if (!isInsideComment(sourceCode, firstCall.index)) break;
      }
      if (firstCall) {
        const opsList = [...foundOps].join(", ");
        findings.push({
          severity: "HIGH",
          category: this.category,
          issue: `SP-API calls (${opsList}) detected without rate limit handling or retry logic`,
          current_pattern:
            "No 429 status code checks, throttle detection, or backoff patterns found",
          impact:
            "Without rate limit handling, throttled requests will fail silently or crash the application",
          location: makeLocation(
            sourceCode,
            firstCall.index,
            firstCall[0].length,
          ),
        });
      }
    }
    return findings;
  }
}

// ── 10. API Modernness ────────────────────────────────────────────

export class ApiModernnessStrategy implements DetectionStrategy {
  readonly category = "api_modernness" as const;

  detect(
    sourceCode: string,
    _language: SupportedLanguage | "agnostic",
    apiSection?: string,
  ): Finding[] {
    const findings: Finding[] = [];
    const currentDate = new Date();

    // Pre-scan: detect which API sections have modern SDK classes present
    const modernSections = new Set<string>();
    for (const [section, pattern] of Object.entries(modernClassIndicators)) {
      if (pattern.test(sourceCode)) {
        modernSections.add(section);
      }
    }

    for (const deprecated of deprecatedApiPatterns) {
      if (
        apiSection &&
        deprecated.apiSection.toLowerCase() !== apiSection.toLowerCase()
      ) {
        continue;
      }

      // If the modern SDK class for this section is present, skip operation-level
      // patterns (like getOrder, getOrders) — they're likely modern API calls.
      // Still flag v0 class/endpoint patterns (like OrdersV0Api, /orders/v0/).
      if (
        modernSections.has(deprecated.apiSection) &&
        !v0ClassPatternNames.has(deprecated.apiName)
      ) {
        continue;
      }

      deprecated.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = deprecated.pattern.exec(sourceCode)) !== null) {
        if (isInsideComment(sourceCode, match.index)) continue;

        const removalDate = new Date(deprecated.removalDate);
        const isRemoved = currentDate > removalDate;
        const daysUntilRemoval = Math.ceil(
          (removalDate.getTime() - currentDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        let severity: "CRITICAL" | "HIGH";
        let urgencyNote: string;

        if (isRemoved) {
          severity = "CRITICAL";
          urgencyNote = `⚠️ REMOVED: This API was removed on ${deprecated.removalDate}. Immediate migration required.`;
        } else {
          severity = "HIGH";
          urgencyNote = `Deprecated since ${deprecated.deprecationDate}. Removal scheduled for ${deprecated.removalDate} (${daysUntilRemoval} days remaining).`;
        }

        findings.push({
          severity,
          category: this.category,
          issue: `Deprecated API detected: ${deprecated.apiName} (${deprecated.deprecatedVersion}) — migrate to ${deprecated.modernVersion}`,
          current_pattern: `Using ${deprecated.apiName} which is deprecated`,
          impact: `${deprecated.description} ${urgencyNote} Migration guide: ${deprecated.migrationGuide}`,
          location: makeLocation(sourceCode, match.index, match[0].length),
        });
      }
    }

    return findings;
  }
}
