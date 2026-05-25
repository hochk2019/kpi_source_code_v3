import React from "react";
import { useAuditLogData } from "./useAuditLogData";
import { AuditLogFilters } from "./AuditLogFilters";
import type { AuthAccountView } from '@/types';

interface AuditLogShellProps {
  currentUser?: AuthAccountView | null;
}

export function AuditLogShell({ currentUser }: AuditLogShellProps) {
  const {
    filteredLogs,
    filter,
    setFilter,
    typeFilter,
    setTypeFilter,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    availableCategories,
    refresh,
    handleResetFilters,
  } = useAuditLogData(currentUser);

  const handleDownload = () => {
    // TODO: implement download
    console.log("Download audit logs");
  };

  return (
    <div className="p-6 space-y-4">
      <AuditLogFilters
        filter={filter}
        setFilter={setFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        availableCategories={availableCategories}
        onReset={handleResetFilters}
        onDownload={handleDownload}
        onRefresh={refresh}
      />

      {/* Placeholder for table - will be implemented in AuditLogTable */}
      <div className="rounded-lg border border-ds-border-subtle bg-ds-surface-card p-4">
        <p className="text-sm text-ds-text-muted">
          {filteredLogs.length} {filteredLogs.length === 1 ? "bản ghi" : "bản ghi"}
        </p>
      </div>
    </div>
  );
}
