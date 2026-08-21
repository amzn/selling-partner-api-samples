# Production Issue Report: Critical Zod Schema Invalidity, Missing Auth Headers, and Express Controller Protocol Bugs in `local-ai-sandbox`

**Issue Number**: #SANDBOX-101  
**Severity**: High / Production-Blocking  
**Component**: `@amzn/selling-partner-api-samples/local-ai-sandbox`  
**Status**: Open (Fix Proposed)  

---

## 1. Overview & Context
The `local-ai-sandbox` module provides a local AI-assisted sandbox server for Amazon Selling Partner API (SP-API) developers. It uses Strands AI agent tools and Express endpoints to simulate SP-API behavior, execute model-driven tools, and process reports.

During technical audit and static/runtime analysis, multiple high-severity defects were identified across tool definitions (`src/tool/*`), server controllers (`src/controller/*`), and data context management.

---

## 2. Detailed Bug Breakdown & Root Causes

### Bug 1: Invalid Zod Schema Instantiation on TypeScript Enums (`z.enum` vs `z.nativeEnum`)
- **Affected Files**: 
  - `src/tool/resourceRetrievalTool.ts`
  - `src/tool/databaseInsertionTool.ts`
  - `src/tool/databaseRemovalTool.ts`
  - `src/tool/databaseLookupTool.ts`
- **Root Cause**: The tools define `inputSchema` using `z.enum(Api)`. In Zod, `z.enum()` expects a tuple of string literal values (`[string, ...string[]]`). `Api` is a TypeScript enum object (`{ LISTINGS: "listings", ... }`). Passing `Api` directly into `z.enum(Api)` causes schema validation errors or runtime crashes when agents attempt to parse tool inputs.
- **Impact**: AI Agents cannot invoke database lookup/insertion/removal or resource retrieval tools, leading to tool invocation failures.

### Bug 2: Omission of `x-amz-access-token` & Unhandled Exception in `callSellingPartnerApiTool`
- **Affected File**: `src/tool/callSellingPartnerApiTool.ts`
- **Root Cause**:
  1. `headers` parameter is optional in Zod schema (`headers: z.record(z.string(), z.string()).optional()`). If omitted by the caller, `headers` is `undefined`. Line 34 evaluates `if (headers !== undefined)` as `false`, bypassing `x-amz-access-token` header injection entirely.
  2. `asyncLocalStorage.getStore()` can return `undefined` outside store scope, causing `store.accessToken` to throw `TypeError: Cannot read properties of undefined (reading 'accessToken')`.
  3. When an HTTP error occurs (`!response.ok`), `throw new Error(...)` discards `responseBody`, preventing agents from inspecting SP-API error payloads.
- **Impact**: SP-API calls fail authentication when headers are omitted; error diagnostics are blinded.

### Bug 3: Express Response Protocol Violation (`.json().send()`) & Unhandled JSON Parsing in `spapiController`
- **Affected File**: `src/controller/spapiController.ts`
- **Root Cause**:
  1. Line 30 executes `response.status(sandboxResponse.statusCode).json(JSON.parse(sandboxResponse.body)).send()`. Express `.json()` automatically ends the HTTP response. Calling `.send()` immediately after `.json()` causes Express warnings and potential ERR_HTTP_HEADERS_SENT exceptions.
  2. If `sandboxResponse.body` is malformed JSON or plain text, `JSON.parse` throws an unhandled exception resulting in an unhandled 500 error.
- **Impact**: Server response instability and improper error status mapping.

### Bug 4: Incorrect Host Header Resolution & Missing Prototype Guards in `reportsController`
- **Affected File**: `src/controller/reportsController.ts`
- **Root Cause**:
  1. Line 94 uses `req.host` to construct document download URLs (`http://${req.host}/reports/download/...`). In Express 4/5, `req.host` strips the port number, producing invalid URLs like `http://localhost/reports/download/DOC-123` instead of `http://localhost:9001/...`. Standard Express usage is `req.get("host")`.
  2. Parameter lookup in several report methods (`getReport`, `downloadReportDocument`, `getReportSchedule`) lacks prototype key guards (`DANGEROUS_KEYS`).
  3. LowDB sync (`await db().read()`) is missing prior to reading `db().data.reports`.
- **Impact**: Document downloads fail due to invalid portless URLs; potential prototype pollution risks.

---

## 3. Steps to Reproduce

1. **Schema Bug**: Attempt to validate input `{ api: "listings", id: "SKU-1" }` using `databaseLookupTool.inputSchema.parse(...)`. Observe Zod validation failure.
2. **Auth Header Bug**: Call `callSellingPartnerApiTool` callback with `{ method: "GET", url: "https://..." }` (omitting `headers`). Observe that `x-amz-access-token` is missing from outgoing request headers.
3. **Controller Bug**: Send a request to an SP-API endpoint in `local-ai-sandbox`. Observe Express console log warning for double response sending (`.json().send()`).
4. **Document Download URL Bug**: Call `GET /reports/2021-06-30/documents/DOC-123`. Observe returned URL is missing port number (`http://localhost/reports/...`).

---

## 4. Proposed Solution & Fix Strategy

1. Update all Zod enum schemas from `z.enum(Api)` to `z.nativeEnum(Api)`.
2. Refactor `callSellingPartnerApiTool` to safely initialize headers, extract `accessToken` conditionally, and preserve error response bodies.
3. Remove redundant `.send()` after `.json()` in `spapiController.ts` and add safe body parsing.
4. Update `reportsController.ts` to use `req.get("host")`, apply prototype pollution checks, and ensure DB sync.
5. Create comprehensive unit tests for tools, schemas, and controllers under `test/`.

---

## 5. Environment & Test System Details
- Node.js v18+ / v20+ / v22+
- TypeScript 5.x
- Vitest 4.x
- Express 4.x
