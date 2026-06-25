# Requirements Document

## Introduction

Comprehensive system redesign of the KPI Calculator application targeting frontend performance optimization, backend completeness verification, ECUS connectivity hardening, and database migration from SQLite to PostgreSQL. This redesign addresses accumulated technical debt after the TypeScript migration (Phases 0–4 complete) and prepares the system for production-grade reliability and scalability.

## Glossary

- **KPI_App**: The full-stack KPI Calculator application comprising frontend (React/Vite), backend (Express/server-v4), and persistence layers
- **Frontend_Router**: The React Router DOM routing layer in `KPICalculator.tsx` responsible for page-level navigation and code splitting
- **Bundle_Optimizer**: The Vite build pipeline including chunk splitting, tree-shaking, and asset optimization configuration
- **Page_Module**: A self-contained frontend feature page (e.g., DataImporter, RulesEditor, ReportViewer, TeamManager) with its associated components and hooks
- **Server_V4**: The TypeScript Express backend (`server-v4/`) containing 14 domain modules with dual-persistence support
- **Domain_Module**: A backend module registered in `module-catalog.ts` providing routes, stores, and business logic for one functional area
- **ECUS_Bridge**: The standalone Node.js service (`apps/ecus-bridge/`) connecting to ECUS SQL Server via MSSQL and syncing declarations to the core API
- **Sync_Pipeline**: The ECUS data flow: fetch from SQL Server → preview → commit to core API
- **Persistence_Layer**: The runtime persistence abstraction (`runtimePersistence.ts`) supporting SQLite and PostgreSQL stores
- **Migration_Engine**: A versioned schema migration system for tracking, applying, and rolling back database schema changes
- **SQLite_Store**: The default persistence using `better-sqlite3` with `kv_store` pattern plus dedicated tables
- **PostgreSQL_Store**: The relational persistence mode activated via `KPI_API_PERSISTENCE_MODE=postgres`
- **Data_Migrator**: A tool for transferring data from SQLite stores to PostgreSQL with integrity verification
- **Legacy_Server**: The original `server/` directory scheduled for retirement (bead cng-sr1.6)
- **Chunk_Strategy**: The Vite configuration defining how JavaScript bundles are split for optimal loading
- **Route_Guard**: Authentication and authorization checks performed before rendering protected pages

## Requirements

### Requirement 1: Route-Level Code Splitting

**User Story:** As a user, I want pages to load only when I navigate to them, so that the initial application load is fast and network bandwidth is conserved.

#### Acceptance Criteria

1. WHEN a user navigates to a Page_Module route, THE Frontend_Router SHALL dynamically import that Page_Module using React.lazy
2. THE Frontend_Router SHALL apply route-level code splitting to all 13 Page_Modules (DataImporter, RulesEditor, ReportViewer, TeamManager, MSTAssignment, KPIAdjustments, AccountManager, HQAgencyManager, DataHealthDashboard, AuditLog, AiAssistant, ReportCenter, AppDashboardLanding)
3. WHILE a Page_Module is loading after navigation, THE Frontend_Router SHALL display a lightweight skeleton placeholder within 50ms of route transition
4. IF a Page_Module fails to load due to network error, THEN THE Frontend_Router SHALL display a retry prompt with a human-readable error message
5. THE Bundle_Optimizer SHALL produce separate chunk files for each Page_Module with no shared page-level code exceeding 50KB uncompressed

### Requirement 2: Vendor and Shared Chunk Optimization

**User Story:** As a developer, I want the build system to produce optimally-sized chunks, so that browser caching is maximized and repeat visits are fast.

#### Acceptance Criteria

1. THE Bundle_Optimizer SHALL split vendor dependencies into stable chunks grouped by update frequency (framework-core, ui-library, utilities)
2. THE Bundle_Optimizer SHALL extract shared code used by 3 or more Page_Modules into a dedicated common chunk
3. THE Bundle_Optimizer SHALL produce an initial critical-path bundle (entry + shell + router) no larger than 150KB gzipped
4. WHEN a new dependency is added, THE Bundle_Optimizer SHALL assign it to the correct vendor chunk based on its category without manual configuration
5. THE Bundle_Optimizer SHALL generate a build manifest reporting per-chunk sizes and composition after each production build

### Requirement 3: Advanced Lazy Loading and Prefetching

**User Story:** As a user, I want likely-next pages to begin loading before I click, so that navigation feels instant.

#### Acceptance Criteria

1. WHEN the user hovers over a navigation link for more than 200ms, THE Frontend_Router SHALL begin prefetching the target Page_Module chunk
2. WHILE the application is idle (no user interaction for 3 seconds after initial load), THE Frontend_Router SHALL prefetch the top 3 most-visited Page_Modules based on navigation frequency data
3. THE Frontend_Router SHALL not prefetch more than 2 Page_Module chunks concurrently to avoid saturating the network
4. WHEN a prefetched Page_Module is navigated to, THE Frontend_Router SHALL render the page without displaying the loading skeleton

### Requirement 4: Frontend UX Flow Redesign — Navigation and Layout

**User Story:** As a user, I want consistent navigation patterns and page layouts across all features, so that the application feels cohesive and learnable.

#### Acceptance Criteria

1. THE KPI_App SHALL present a unified page layout pattern (page header with title and actions, content area, optional sidebar) across all 13 Page_Modules
2. THE KPI_App SHALL provide breadcrumb navigation reflecting the current location within the application hierarchy
3. WHEN a user performs a destructive action (delete, overwrite, reset), THE KPI_App SHALL require explicit confirmation via a modal dialog before executing
4. THE KPI_App SHALL preserve scroll position and filter state when navigating back to a previously visited Page_Module within the same session
5. WHILE a background operation is in progress (sync, import, export), THE KPI_App SHALL display a persistent non-blocking status indicator in the application shell

### Requirement 5: Frontend UX Flow Redesign — Data Entry and Feedback

**User Story:** As a user, I want clear feedback during data operations and consistent form interactions, so that I can work confidently without data loss.

#### Acceptance Criteria

1. WHEN a form contains unsaved changes and the user attempts to navigate away, THE KPI_App SHALL display a confirmation dialog warning of potential data loss
2. THE KPI_App SHALL provide inline field-level validation errors within 300ms of field blur for all form inputs
3. WHEN a save or submit operation succeeds, THE KPI_App SHALL display a toast notification confirming success within 500ms
4. IF a save or submit operation fails, THEN THE KPI_App SHALL display an error toast with a retry action and preserve all form input values
5. THE KPI_App SHALL support keyboard-only navigation for all interactive elements in compliance with WCAG 2.1 AA focus management

### Requirement 6: Backend Completeness Verification

**User Story:** As a developer, I want assurance that every frontend feature has complete backend support, so that no page renders with missing or broken API calls.

#### Acceptance Criteria

1. THE Server_V4 SHALL expose API endpoints for every data operation performed by all 13 frontend Page_Modules
2. THE Server_V4 SHALL return consistent error response shapes (status code, error code, message, details) across all Domain_Modules
3. THE Server_V4 SHALL validate all incoming request bodies against Zod schemas before processing
4. WHEN the frontend calls an endpoint that does not exist, THE Server_V4 SHALL return a 404 response with a machine-readable error code identifying the missing resource
5. THE Server_V4 SHALL include API versioning headers in all responses to support future backward-compatible evolution

### Requirement 7: Legacy Server Retirement

**User Story:** As a developer, I want the legacy server directory removed, so that the codebase has a single authoritative backend and maintenance burden is reduced.

#### Acceptance Criteria

1. WHEN the Legacy_Server directory is removed, THE Server_V4 SHALL handle all requests previously served by the Legacy_Server without behavior change
2. THE KPI_App SHALL not contain any import references to the Legacy_Server directory after retirement
3. WHEN the Legacy_Server is retired, THE KPI_App build and test pipelines SHALL pass without Legacy_Server files present
4. THE Server_V4 SHALL provide a parity verification script that confirms endpoint-by-endpoint equivalence with the Legacy_Server before deletion

### Requirement 8: ECUS Connectivity Hardening — Retry and Recovery

**User Story:** As an operator, I want the ECUS bridge to recover automatically from transient failures, so that data synchronization is reliable without manual intervention.

#### Acceptance Criteria

1. IF the ECUS_Bridge encounters a transient SQL Server connection failure, THEN THE ECUS_Bridge SHALL retry the connection with exponential backoff (initial delay 1 second, maximum delay 60 seconds, maximum 5 attempts)
2. IF all retry attempts are exhausted, THEN THE ECUS_Bridge SHALL persist the failed sync request to a durable retry queue
3. WHEN connectivity is restored after a failure, THE ECUS_Bridge SHALL process all queued sync requests in FIFO order
4. THE ECUS_Bridge SHALL log each retry attempt with timestamp, attempt number, and failure reason
5. IF a sync request fails 3 consecutive times from the retry queue, THEN THE ECUS_Bridge SHALL mark the request as dead-lettered and emit an alert notification

### Requirement 9: ECUS Scheduled Auto-Sync

**User Story:** As an operator, I want the ECUS bridge to synchronize data on a configurable schedule, so that the KPI application always has recent declaration data without manual triggering.

#### Acceptance Criteria

1. THE ECUS_Bridge SHALL support a configurable cron-based schedule for automatic synchronization
2. WHEN the scheduled sync time arrives, THE ECUS_Bridge SHALL execute the full Sync_Pipeline (fetch → preview → commit) without user intervention
3. WHILE a scheduled sync is already in progress, THE ECUS_Bridge SHALL skip the next scheduled trigger and log a warning
4. THE ECUS_Bridge SHALL expose the current schedule configuration, last sync timestamp, and next scheduled sync time via a status endpoint
5. WHEN the auto-sync schedule is modified, THE ECUS_Bridge SHALL apply the new schedule without requiring a service restart

### Requirement 10: ECUS Monitoring and Observability

**User Story:** As an operator, I want visibility into ECUS bridge health and sync history, so that I can detect problems before they affect KPI calculations.

#### Acceptance Criteria

1. THE ECUS_Bridge SHALL expose a health endpoint reporting connection status, last successful sync time, queue depth, and error count
2. THE ECUS_Bridge SHALL record a sync history log with start time, end time, rows fetched, rows committed, and outcome (success/failure/partial)
3. WHEN the time since last successful sync exceeds a configurable threshold (default 24 hours), THE ECUS_Bridge SHALL emit a stale-data alert
4. THE ECUS_Bridge SHALL report the average sync duration and 95th percentile sync duration over the last 7 days via the status endpoint
5. IF the ECUS SQL Server reports health degradation, THEN THE ECUS_Bridge SHALL log a warning and include the degradation details in the health endpoint response

### Requirement 11: Database Migration Strategy — SQLite to PostgreSQL

**User Story:** As an operator, I want a safe, verified migration path from SQLite to PostgreSQL, so that I can move to production-grade persistence without data loss.

#### Acceptance Criteria

1. THE Data_Migrator SHALL transfer all data from SQLite_Store tables to corresponding PostgreSQL_Store tables preserving row count and field values
2. THE Data_Migrator SHALL verify data integrity after migration by comparing checksums or row-by-row equivalence for each table
3. WHEN data integrity verification fails for any table, THE Data_Migrator SHALL halt the migration, report the discrepancy, and leave the PostgreSQL_Store in its pre-migration state
4. THE Data_Migrator SHALL support resumable migration, allowing restart from the last successfully migrated table after interruption
5. THE Data_Migrator SHALL generate a migration report listing each table, row counts (source vs destination), duration, and verification result
6. THE Data_Migrator SHALL operate while the application is offline to prevent concurrent writes during transfer

### Requirement 12: Versioned Schema Migration System

**User Story:** As a developer, I want a versioned migration system for database schema changes, so that schema evolution is traceable, repeatable, and reversible.

#### Acceptance Criteria

1. THE Migration_Engine SHALL track applied migrations in a dedicated migrations metadata table with version number, name, applied timestamp, and checksum
2. THE Migration_Engine SHALL apply pending migrations in sequential version order on application startup
3. THE Migration_Engine SHALL support rollback of the most recent migration via a down-migration script
4. IF a migration fails during execution, THEN THE Migration_Engine SHALL roll back the failed migration transaction and leave the database at the previous version
5. THE Migration_Engine SHALL reject duplicate migration version numbers at validation time before execution
6. THE Migration_Engine SHALL support both SQLite_Store and PostgreSQL_Store targets using the same migration file format

### Requirement 13: PostgreSQL Schema Improvements

**User Story:** As a developer, I want the PostgreSQL schema to use proper relational constraints and indexes, so that data integrity is enforced at the database level and queries perform well.

#### Acceptance Criteria

1. THE PostgreSQL_Store SHALL enforce foreign key constraints between related tables (teams → members, declarations → import_jobs, adjustments → rules)
2. THE PostgreSQL_Store SHALL include indexes on all columns used in WHERE clauses and JOIN conditions across Domain_Module queries
3. THE PostgreSQL_Store SHALL use appropriate column types with NOT NULL constraints for required fields as defined by Domain_Module validation schemas
4. WHEN a Domain_Module writes data violating a constraint, THE Persistence_Layer SHALL return a structured error identifying the violated constraint
5. THE PostgreSQL_Store SHALL include created_at and updated_at timestamp columns with automatic population on all entity tables

### Requirement 14: System Audit and Gap Analysis

**User Story:** As a technical lead, I want a comprehensive audit identifying all gaps between frontend needs and backend capabilities, so that remediation work is properly scoped.

#### Acceptance Criteria

1. THE KPI_App SHALL include an automated API contract verification script that compares frontend API calls against Server_V4 registered endpoints
2. WHEN the contract verification identifies a frontend call without a matching backend endpoint, THE script SHALL report the gap with the calling Page_Module, HTTP method, and path
3. WHEN the contract verification identifies a backend endpoint with no frontend caller, THE script SHALL report the unused endpoint for deprecation review
4. THE contract verification script SHALL execute as part of the CI pipeline and fail the build if new gaps are introduced
5. THE KPI_App SHALL maintain a living gap-analysis document updated by the contract verification script after each run
