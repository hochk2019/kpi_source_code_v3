# Implementation Plan: System Redesign 2026

## Overview

Comprehensive implementation of the KPI Calculator system redesign covering frontend performance (code splitting, vendor chunks, prefetching), UX consistency (layout, navigation, forms), backend completeness (API contract, legacy retirement), ECUS connectivity hardening (retry, scheduler, observability), and database evolution (SQLite→PostgreSQL migration engine). All code is TypeScript, tests use Vitest + fast-check.

## Tasks

- [x] 1. Frontend Bundle Infrastructure
  - [x] 1.1 Implement Vite chunk strategy with category-based vendor splitting
    - Enhance `vite.config.js` `manualChunks` with `CHUNK_CATEGORIES` array (vendor-react-dom, vendor-radix, vendor-lucide, vendor-recharts, vendor-form, vendor-motion, vendor-misc)
    - Implement priority-based conflict resolution when a module matches multiple categories
    - Extract shared code used by ≥3 Page_Modules into a `common` chunk
    - Verify entry bundle (main + shell + router) ≤ 150KB gzipped
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x]* 1.2 Write property test for chunk categorization (Property 1)
    - **Property 1: Dependency Chunk Categorization**
    - For any npm package identifier string, the categorization function assigns exactly one vendor chunk, deterministically
    - **Validates: Requirements 2.4**

  - [x] 1.3 Implement build manifest reporter plugin
    - Create Vite plugin that generates `BuildManifest` JSON after production build
    - Report per-chunk: name, files, sizeBytes, sizeGzip, modules list
    - Report `criticalPathSize` (entry + shell + router gzipped)
    - Output to `dist/build-manifest.json`
    - _Requirements: 2.5_

- [x] 2. Route-Level Code Splitting and Lazy Loading
  - [x] 2.1 Refactor KPICalculator.tsx to use React.lazy for all 13 Page_Modules
    - Replace static imports with `React.lazy(() => import(...))` for all pages: DataImporter, RulesEditor, ReportViewer, TeamManager, MSTAssignment, KPIAdjustments, AccountManager, HQAgencyManager, DataHealthDashboard, AuditLog, AiAssistant, ReportCenter, AppDashboardLanding
    - Wrap routes in `<Suspense>` with lightweight skeleton placeholder (render within 50ms)
    - Add `RuntimeErrorBoundary` per route for load-failure retry prompt
    - Verify the build emits a separate chunk file for each of the 13 Page_Modules with no shared page-level code chunk exceeding 50KB uncompressed
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Implement PrefetchManager service
    - Create `src/lib/prefetchManager.ts` implementing the `PrefetchManager` interface
    - Prefetch on hover after 200ms dwell time
    - Idle-time prefetch (3s inactivity) for top-3 most-visited pages using `NavigationFrequency` data from localStorage
    - Enforce max 2 concurrent prefetches
    - Track `isReady` state to skip loading skeleton for prefetched modules
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x]* 2.3 Write property test for navigation frequency top-N selection (Property 2)
    - **Property 2: Navigation Frequency Top-N Selection**
    - For any frequency entries array and N > 0, returns min(N, length) items where every returned item has visitCount >= every non-returned item
    - **Validates: Requirements 3.2**

  - [x]* 2.4 Write property test for prefetch concurrency limit (Property 3)
    - **Property 3: Prefetch Concurrency Limit Invariant**
    - For any sequence of prefetch triggers, in-flight count never exceeds 2
    - **Validates: Requirements 3.3**

- [x] 3. Checkpoint — Frontend bundle and code splitting
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend UX — Navigation and Layout
  - [x] 4.1 Implement unified page layout pattern
    - Create `src/components/layout/PageLayout.tsx` with page header (title + actions), content area, optional sidebar
    - Apply to all 13 Page_Modules as a wrapper component
    - _Requirements: 4.1_

  - [x] 4.2 Implement breadcrumb navigation component
    - Create `src/components/layout/Breadcrumbs.tsx` that generates breadcrumbs from current route path
    - Each segment's path is a prefix of the next; final segment matches current route
    - Integrate into `PageLayout` header area
    - _Requirements: 4.2_

  - [x]* 4.3 Write property test for breadcrumb generation (Property 4)
    - **Property 4: Breadcrumb Generation from Route Path**
    - For any valid route path, breadcrumbs produce ordered segments where each path is a prefix of the next
    - **Validates: Requirements 4.2**

  - [x] 4.4 Implement NavigationStateStore for scroll/filter preservation
    - Create `src/lib/navigationStateStore.ts` implementing `NavigationStateStore` interface
    - Save/restore `PageState` (scrollTop, filters, sortColumn, sortDirection) keyed by route
    - Persist in sessionStorage for same-session navigation
    - Wire into route change handlers to auto-save on leave, auto-restore on return
    - _Requirements: 4.4_

  - [x]* 4.5 Write property test for navigation state round-trip (Property 5)
    - **Property 5: Navigation State Round-Trip Preservation**
    - For any PageState, save then restore returns deeply equal object
    - **Validates: Requirements 4.4**

  - [x] 4.6 Implement destructive action confirmation and background status indicator
    - Create confirmation modal hook `useDestructiveConfirm` for delete/overwrite/reset actions
    - Create persistent non-blocking status indicator in AppShellFrame for background operations (sync, import, export)
    - _Requirements: 4.3, 4.5_

- [x] 5. Frontend UX — Data Entry and Feedback
  - [x] 5.1 Implement unsaved changes guard and form dirty detection
    - Create `useUnsavedChangesGuard` hook that intercepts navigation when form is dirty
    - Implement dirty detection comparing current field values vs initial state
    - Display confirmation dialog on navigation attempt with unsaved changes
    - _Requirements: 5.1_

  - [x]* 5.2 Write property test for dirty form detection (Property 6)
    - **Property 6: Dirty Form Detection**
    - For any form with initial state: changed field → dirty=true; all fields equal initial → dirty=false
    - **Validates: Requirements 5.1**

  - [x] 5.3 Implement inline field validation and toast notifications
    - Create `useFieldValidation` hook that runs Zod schema validation on field blur within 300ms
    - Display inline error messages below fields
    - Implement toast notification system: success toast within 500ms of save, error toast with retry action on failure
    - Preserve all form input values on failed submission
    - _Requirements: 5.2, 5.3, 5.4_

  - [x]* 5.4 Write property test for field validation error generation (Property 7)
    - **Property 7: Field Validation Error Generation**
    - For any field value violating Zod schema → non-empty error message; for valid value → no error
    - **Validates: Requirements 5.2**

  - [x] 5.5 Implement keyboard-only navigation and focus management
    - Audit all interactive elements for proper tabIndex, focus indicators, and ARIA attributes
    - Ensure WCAG 2.1 AA compliance for focus management across all Page_Modules
    - _Requirements: 5.5_

- [x] 6. Checkpoint — Frontend UX complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Backend API Contract Layer
  - [x] 7.1 Implement consistent API error response middleware
    - Create `server-v4/src/middleware/apiContract.ts` with `ApiErrorResponse` shape enforcement
    - Add `X-API-Version` and `X-API-Module` headers to all responses
    - Return 404 with machine-readable error code for non-existent endpoints
    - _Requirements: 6.2, 6.4, 6.5_

  - [x] 7.2 Implement Zod request body validation middleware
    - Create `validateBody<T>` middleware factory using Zod schemas
    - Return 400 with `VALIDATION_FAILED` code and flattened Zod errors on invalid input
    - Apply to all Domain_Module route handlers that accept request bodies
    - _Requirements: 6.3_

  - [x]* 7.3 Write property test for API response contract invariants (Property 8)
    - **Property 8: API Response Contract Invariants**
    - For any HTTP response: errors match ApiErrorResponse shape, invalid bodies get 400/VALIDATION_FAILED, all responses include version headers
    - **Validates: Requirements 6.2, 6.3, 6.5**

  - [x] 7.4 Verify backend endpoint coverage for all 13 Page_Modules
    - Audit each Page_Module's API calls against Server_V4 registered endpoints
    - Implement any missing endpoints to ensure full frontend coverage
    - _Requirements: 6.1_

- [x] 8. Legacy Server Retirement
  - [x] 8.1 Create parity verification script
    - Create `scripts/verify-legacy-parity.ts` comparing Legacy_Server endpoints vs Server_V4
    - Run endpoint-by-endpoint equivalence check confirming Server_V4 handles all legacy routes
    - _Requirements: 7.4_

  - [x] 8.2 Remove Legacy_Server directory and update imports
    - Delete `server/` directory after parity verification passes
    - Remove all import references to Legacy_Server across the codebase
    - Verify build and test pipelines pass without Legacy_Server files
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. Checkpoint — Backend contract and legacy retirement
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. ECUS Bridge — Retry and Recovery Engine
  - [x] 10.1 Implement RetryEngine with exponential backoff
    - Create `apps/ecus-bridge/src/retryEngine.ts` implementing `RetryEngine` interface
    - Implement `withRetry<T>` with configurable exponential backoff (initial 1s, max 60s, factor 2, max 5 attempts)
    - Implement `calculateBackoffDelay` pure function
    - Log each retry attempt with timestamp, attempt number, and failure reason
    - _Requirements: 8.1, 8.4_

  - [x]* 10.2 Write property test for exponential backoff calculation (Property 9)
    - **Property 9: Exponential Backoff Delay Calculation**
    - For any attempt number and valid RetryConfig, delay = min(initial * factor^(attempt-1), maxDelay), monotonically non-decreasing
    - **Validates: Requirements 8.1**

  - [x] 10.3 Implement durable retry queue with FIFO processing
    - Create `ecus_retry_queue` table (SQLite or file-based for bridge)
    - Implement `enqueue()` to persist failed sync requests
    - Implement `processQueue()` processing items in FIFO order (earliest createdAt first)
    - Dead-letter items after 3 consecutive queue failures with alert emission
    - _Requirements: 8.2, 8.3, 8.5_

  - [x]* 10.4 Write property test for retry queue FIFO ordering (Property 10)
    - **Property 10: Retry Queue FIFO Ordering**
    - For any sequence of enqueued requests, processQueue dequeues in createdAt order
    - **Validates: Requirements 8.3**

- [x] 11. ECUS Bridge — Scheduled Auto-Sync
  - [x] 11.1 Implement SyncScheduler with hot-reload support
    - Create `apps/ecus-bridge/src/syncScheduler.ts` implementing `SyncScheduler` interface
    - Use `node-cron` for cron-based scheduling
    - Implement concurrency guard: skip trigger if sync already in progress, log warning
    - Support `updateSchedule()` for hot-reload without service restart
    - Expose status endpoint with cronExpression, lastSyncAt, nextSyncAt, syncInProgress
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x]* 11.2 Write property test for sync concurrency guard (Property 11)
    - **Property 11: Sync Concurrency Guard**
    - For any sequence of schedule triggers, at most one sync operation is active at any time
    - **Validates: Requirements 9.3**

- [x] 12. ECUS Bridge — Monitoring and Observability
  - [x] 12.1 Implement HealthMonitor with sync history tracking
    - Create `apps/ecus-bridge/src/healthMonitor.ts` implementing `HealthMonitor` interface
    - Create `ecus_sync_history` table for recording sync outcomes
    - Record every sync with startedAt, completedAt, rowsFetched, rowsCommitted, outcome, durationMs
    - Implement stale-data alert (configurable threshold, default 24 hours)
    - Compute average and p95 sync duration over 7-day window
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 12.2 Implement health and status HTTP endpoints
    - Expose `GET /health` endpoint returning `HealthReport` JSON
    - Include connection status, last successful sync, queue depth, error count, stale-data alert
    - Include SQL Server health degradation details when applicable
    - _Requirements: 10.1, 10.5_

  - [x]* 12.3 Write property test for sync history record completeness (Property 12)
    - **Property 12: Sync History Record Completeness**
    - For any completed sync, recorded entry has all non-null required fields and durationMs = completedAt - startedAt
    - **Validates: Requirements 10.2**

  - [x]* 12.4 Write property test for stale-data alert threshold (Property 13)
    - **Property 13: Stale-Data Alert Threshold**
    - checkStaleData returns true iff (now - lastSync) > threshold; monotonic in threshold
    - **Validates: Requirements 10.3**

  - [x]* 12.5 Write property test for duration statistics calculation (Property 14)
    - **Property 14: Duration Statistics Calculation**
    - For any non-empty durations array: average = sum/count, p95 = ceil(0.95*count)-th sorted value
    - **Validates: Requirements 10.4**

- [x] 13. Checkpoint — ECUS bridge hardening complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Schema Migration Engine
  - [x] 14.1 Implement MigrationEngine with sequential application and rollback
    - Create `server-v4/src/migration/migrationEngine.ts` implementing `MigrationEngine` interface
    - Create `_migrations` metadata table (version, name, applied_at, checksum, rolled_back)
    - Implement `applyPending()`: apply in ascending version order within transactions
    - Implement `rollbackLast()`: execute down script, mark as rolled back
    - Implement `validate()`: reject duplicate version numbers, verify checksums
    - Support both SQLite and PostgreSQL targets using same migration file format
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x]* 14.2 Write property test for schema migration sequential ordering (Property 18)
    - **Property 18: Schema Migration Sequential Ordering**
    - For any pending migrations with distinct versions, applyPending applies in strictly ascending order
    - **Validates: Requirements 12.2**

  - [x]* 14.3 Write property test for schema migration apply-rollback round-trip (Property 19)
    - **Property 19: Schema Migration Apply-Rollback Round-Trip**
    - Apply then rollback returns schema to pre-migration state
    - **Validates: Requirements 12.3**

  - [x]* 14.4 Write property test for failed migration transaction atomicity (Property 20)
    - **Property 20: Failed Migration Transaction Atomicity**
    - If up script errors, entire transaction rolls back, DB stays at previous version
    - **Validates: Requirements 12.4**

  - [x]* 14.5 Write property test for duplicate migration version rejection (Property 21)
    - **Property 21: Duplicate Migration Version Rejection**
    - If two migration files share a version number, validate() returns valid=false with error
    - **Validates: Requirements 12.5**

- [x] 15. Data Migrator — SQLite to PostgreSQL
  - [x] 15.1 Implement DataMigrator with integrity verification
    - Create `server-v4/src/migration/dataMigrator.ts` implementing `DataMigrator` interface
    - Transfer all SQLite_Store tables to PostgreSQL_Store preserving row count and values
    - Verify integrity post-migration via row-by-row comparison or checksum
    - Halt and rollback on verification failure, report discrepancy
    - Support resumable migration from checkpoint (last successfully migrated table)
    - Generate migration report (table, row counts source/dest, duration, verification result)
    - Require offline application mode during transfer
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x]* 15.2 Write property test for migration data integrity round-trip (Property 15)
    - **Property 15: Migration Data Integrity Round-Trip**
    - After successful migration, PostgreSQL contains exactly the same rows as SQLite source
    - **Validates: Requirements 11.1, 11.2**

  - [x]* 15.3 Write property test for migration rollback atomicity (Property 16)
    - **Property 16: Migration Rollback Atomicity**
    - On verification failure at table N, PostgreSQL is left in pre-migration state (no partial data)
    - **Validates: Requirements 11.3**

  - [x]* 15.4 Write property test for resumable migration checkpoint (Property 17)
    - **Property 17: Resumable Migration Checkpoint**
    - After interruption at table K, resumeFrom skips 1..K and result equals uninterrupted migration
    - **Validates: Requirements 11.4**

- [x] 16. PostgreSQL Schema Improvements
  - [x] 16.1 Create PostgreSQL schema migration files with constraints and indexes
    - Write migration files for all entity tables with proper FK constraints (teams→agencies, declarations→import_jobs, adjustments→rules)
    - Add indexes on all WHERE/JOIN columns across Domain_Module queries
    - Add NOT NULL constraints for required fields per Zod validation schemas
    - Add created_at/updated_at timestamp columns with auto-population triggers
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

  - [x] 16.2 Implement structured constraint violation error handling
    - Update Persistence_Layer to catch PostgreSQL constraint violations
    - Return structured error with constraint name, violation type, and affected columns
    - Map to `ApiErrorResponse` with 409/CONSTRAINT_VIOLATION code
    - _Requirements: 13.4_

  - [x]* 16.3 Write property test for foreign key constraint enforcement (Property 22)
    - **Property 22: Foreign Key Constraint Enforcement**
    - INSERT/UPDATE referencing non-existent FK → rejection with structured error
    - **Validates: Requirements 13.1**

  - [x]* 16.4 Write property test for constraint violation structured error (Property 23)
    - **Property 23: Constraint Violation Structured Error**
    - Any constraint violation (FK, NOT NULL, UNIQUE, CHECK) returns error with constraint name, type, columns
    - **Validates: Requirements 13.4**

  - [x]* 16.5 Write property test for timestamp auto-population (Property 24)
    - **Property 24: Timestamp Auto-Population**
    - INSERT sets both created_at and updated_at to now; UPDATE changes updated_at only
    - **Validates: Requirements 13.5**

- [x] 17. Checkpoint — Database migration infrastructure complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. System Audit and Contract Verification
  - [x] 18.1 Enhance contract verification script with gap detection
    - Enhance `scripts/check-frontend-api-contract.mjs` to produce `ContractReport` JSON
    - Detect frontend calls without matching backend endpoint (missingBackend gaps)
    - Detect backend endpoints with no frontend caller (unusedBackend gaps)
    - Report each gap with Page_Module, HTTP method, path, and source file location
    - Track newGapsSinceLastRun by comparing with previous report
    - _Requirements: 14.1, 14.2, 14.3_

  - [x]* 18.2 Write property test for contract verification gap detection (Property 25)
    - **Property 25: Contract Verification Gap Detection**
    - For sets F (frontend calls) and B (backend endpoints): F\B → missingBackend, B\F → unusedBackend
    - **Validates: Requirements 14.2, 14.3**

  - [x] 18.3 Integrate contract verification into CI pipeline
    - Add contract check as CI step that fails build if new gaps are introduced
    - Generate living gap-analysis document updated after each run
    - _Requirements: 14.4, 14.5_

- [x] 19. Final Checkpoint — Full system integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical boundaries
- Property tests validate universal correctness properties using Vitest + fast-check
- Unit tests validate specific examples and edge cases
- All code is TypeScript targeting the existing monorepo structure (apps/api, apps/ecus-bridge, apps/web, server-v4)
- Frontend components go in `src/components/` following existing patterns
- Backend modules follow the `server-v4/src/` domain module pattern with `module-catalog.ts` registration
- ECUS bridge code goes in `apps/ecus-bridge/src/`
- Migration engine lives in `server-v4/src/migration/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1", "7.1", "7.2"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1", "4.2", "4.4", "7.4"] },
    { "id": 2, "tasks": ["2.2", "4.3", "4.5", "4.6", "7.3", "8.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "5.1", "5.3", "8.2"] },
    { "id": 4, "tasks": ["5.2", "5.4", "5.5", "10.1"] },
    { "id": 5, "tasks": ["10.2", "10.3", "11.1", "14.1"] },
    { "id": 6, "tasks": ["10.4", "11.2", "12.1", "14.2", "14.3", "14.4", "14.5"] },
    { "id": 7, "tasks": ["12.2", "12.3", "12.4", "12.5", "15.1"] },
    { "id": 8, "tasks": ["15.2", "15.3", "15.4", "16.1"] },
    { "id": 9, "tasks": ["16.2", "16.3", "16.4", "16.5"] },
    { "id": 10, "tasks": ["18.1"] },
    { "id": 11, "tasks": ["18.2", "18.3"] }
  ]
}
```
