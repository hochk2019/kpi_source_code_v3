import React from "react";
import { cn } from "../../../src/lib/utils.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../src/components/ui/table.jsx";
import { Badge } from "../../../src/components/ui/badge.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../src/components/ui/select.jsx";
import {
  Dialog as BaseDialog,
  DialogContent as BaseDialogContent,
  DialogDescription as BaseDialogDescription,
  DialogFooter as BaseDialogFooter,
  DialogHeader as BaseDialogHeader,
  DialogTitle as BaseDialogTitle,
  DialogTrigger as BaseDialogTrigger,
  DialogClose as BaseDialogClose,
} from "../../../src/components/ui/dialog.jsx";

// ─── DataTable ──────────────────────────────────────────────────────────────

export interface DataTableColumn<T = Record<string, unknown>> {
  key: string;
  id?: string;
  accessor?: string;
  label?: React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  headerClassName?: string;
  cellClassName?: string;
  headProps?: Record<string, unknown>;
  cellProps?: Record<string, unknown>;
  renderHeader?: (column: DataTableColumn<T>) => React.ReactNode;
  cell?: (item: T, index: number) => React.ReactNode;
  /** Enable inline editing for this column */
  editable?: boolean;
  /** Sortable column */
  sortable?: boolean;
  /** Current sort direction */
  sortDirection?: "asc" | "desc" | null;
  /** Callback when header clicked for sorting */
  onSort?: () => void;
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: DataTableColumn<T>[];
  data?: T[];
  rowKey?: string | ((item: T, index: number) => string);
  isLoading?: boolean;
  emptyState?: React.ReactNode | (() => React.ReactNode);
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  zebra?: boolean;
  density?: "compact" | "comfortable" | "relaxed";
  stickyHeader?: boolean;
  caption?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  /** Row selection */
  selection?: {
    selectedIds: string[];
    onSelect: (id: string, selected: boolean) => void;
    onSelectAll: (selected: boolean) => void;
    keyExtractor?: (item: T) => string;
  };
  /** Error state */
  error?: {
    message: string;
    onRetry?: () => void;
  } | null;
  /** Column resizing */
  columnResize?: {
    enabled: boolean;
    onResize?: (columnKey: string, width: number) => void;
  };
  /** Global sort handler */
  onSort?: (columnKey: string, direction: "asc" | "desc") => void;
  /** Sort configuration */
  sort?: {
    column: string | null;
    direction: "asc" | "desc" | null;
  };
  /** Inline editing */
  editable?: {
    enabled: boolean;
    onCellChange?: (rowId: string, columnKey: string, value: unknown) => void;
    editingCell?: { rowId: string; columnKey: string } | null;
    onStartEdit?: (rowId: string, columnKey: string) => void;
    onCancelEdit?: () => void;
  };
}

const densityPadding: Record<string, string> = {
  compact: "py-2",
  comfortable: "py-2.5",
  relaxed: "py-3.5",
};

export function DataTable<T extends Record<string, unknown> = Record<string, unknown>>({
  columns = [],
  data = [],
  rowKey,
  isLoading = false,
  emptyState = "Không có dữ liệu.",
  className,
  headerClassName,
  bodyClassName,
  zebra = false,
  density = "comfortable",
  stickyHeader = false,
  caption,
  ariaLabel,
  ariaDescribedBy,
  selection,
  error,
  columnResize,
  onSort,
  sort,
  editable,
}: DataTableProps<T>) {
  const paddingClass = densityPadding[density] || densityPadding.comfortable;
  const hasSelection = selection != null;
  const colCount = columns.length + (hasSelection ? 1 : 0);

  const resolvedRowKey =
    typeof rowKey === "function"
      ? rowKey
      : (item: T, index: number) =>
          typeof rowKey === "string" && item && item[rowKey] != null
            ? `${rowKey}:${item[rowKey]}`
            : `row-${index}`;

  const getRowId = (item: T, index: number): string => {
    if (selection?.keyExtractor) {
      return selection.keyExtractor(item);
    }
    return resolvedRowKey(item, index);
  };

  const isAllSelected = data.length > 0 && data.every((item, idx) =>
    selection?.selectedIds.includes(getRowId(item, idx))
  );

  const isSomeSelected = data.some((item, idx) =>
    selection?.selectedIds.includes(getRowId(item, idx))
  ) && !isAllSelected;

  const handleSelectAll = (checked: boolean) => {
    selection?.onSelectAll(checked);
  };

  const handleSelectRow = (item: T, index: number, checked: boolean) => {
    const id = getRowId(item, index);
    selection?.onSelect(id, checked);
  };

  const renderEmpty = () => {
    if (typeof emptyState === "function") {
      return emptyState();
    }
    return <div>{emptyState}</div>;
  };

  // Error state
  if (error) {
    return (
      <div className={cn("ds-table-wrapper", className)}>
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-ds-destructive mb-2">
            <span className="text-2xl">⚠</span>
          </div>
          <p className="text-ds-text-secondary text-sm mb-4">{error.message}</p>
          {error.onRetry ? (
            <button
              type="button"
              onClick={error.onRetry}
              className="rounded-md bg-ds-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-ds-accent/90"
            >
              Thử lại
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("ds-table-wrapper", className)}>
      <Table
        className={cn("ds-table", stickyHeader && "ds-table--sticky")}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      >
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader
          className={cn(
            "ds-table__header",
            stickyHeader && "ds-table__header--sticky",
            headerClassName,
          )}
        >
          <TableRow>
            {/* Selection header */}
            {hasSelection ? (
              <TableHead className={cn("ds-table__head w-10", paddingClass)}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Chọn tất cả"
                  className="h-4 w-4 rounded border-ds-border-subtle text-ds-accent focus:ring-ds-accent"
                />
              </TableHead>
            ) : null}
            {columns.map((column) => {
              const headProps = column?.headProps || {};
              const alignClass =
                column.align === "right"
                  ? "text-right"
                  : column.align === "center"
                    ? "text-center"
                    : "text-left";
              const isSorted = sort?.column === column.key;
              const sortDirection = isSorted ? sort?.direction : null;
              const canSort = column.sortable || onSort != null;

              const handleHeaderClick = () => {
                if (canSort && onSort) {
                  const newDirection = sortDirection === "asc" ? "desc" : "asc";
                  onSort(column.key, newDirection);
                }
                column.onSort?.();
              };

              return (
                <TableHead
                  key={column.key || column.id || column.accessor || String(column.label)}
                  className={cn(
                    "ds-table__head",
                    alignClass,
                    paddingClass,
                    column?.headerClassName,
                    canSort && "cursor-pointer hover:bg-ds-surface-muted",
                  )}
                  style={{
                    width: column?.width,
                    minWidth: column?.minWidth,
                    maxWidth: column?.maxWidth,
                  }}
                  onClick={canSort ? handleHeaderClick : undefined}
                  {...headProps}
                >
                  <div className="flex items-center gap-1">
                    {column.renderHeader ? column.renderHeader(column) : column.label}
                    {canSort && sortDirection ? (
                      <span className="text-ds-accent text-xs">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    ) : null}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody className={cn("ds-table__body", bodyClassName)}>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={colCount} className={cn("text-center text-[color:var(--ds-text-muted)]", paddingClass)}>
                Đang tải dữ liệu…
              </TableCell>
            </TableRow>
          ) : data && data.length > 0 ? (
            data.map((item, index) => {
              const key = resolvedRowKey(item, index);
              const rowId = getRowId(item, index);
              const isSelected = selection?.selectedIds.includes(rowId);
              const rowClassName = cn(
                "align-top",
                zebra && index % 2 === 1 && "ds-table__row--zebra",
                isSelected && "bg-ds-accent/5",
                (item as Record<string, unknown>)?.rowClassName as string | undefined,
              );

              return (
                <TableRow key={key} className={rowClassName} data-row-index={index}>
                  {/* Selection cell */}
                  {hasSelection ? (
                    <TableCell className={cn("w-10", paddingClass)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(item, index, e.target.checked)}
                        aria-label={`Chọn dòng ${index + 1}`}
                        className="h-4 w-4 rounded border-ds-border-subtle text-ds-accent focus:ring-ds-accent"
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => {
                    const cellProps = column?.cellProps || {};
                    const alignClass =
                      column.align === "right"
                        ? "text-right"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left";

                    const isEditing = editable?.enabled &&
                      editable.editingCell?.rowId === rowId &&
                      editable.editingCell?.columnKey === column.key;

                    const canEdit = column.editable && editable?.enabled;

                    const handleCellClick = () => {
                      if (canEdit && editable?.onStartEdit) {
                        editable.onStartEdit(rowId, column.key);
                      }
                    };

                    const handleCellChange = (value: unknown) => {
                      if (editable?.onCellChange) {
                        editable.onCellChange(rowId, column.key, value);
                      }
                    };

                    const content =
                      typeof column.cell === "function"
                        ? column.cell(item, index)
                        : item?.[column.key as keyof T];

                    return (
                      <TableCell
                        key={`${key}-${column.key || column.id}`}
                        className={cn(
                          "ds-table__cell",
                          alignClass,
                          paddingClass,
                          column?.cellClassName,
                          canEdit && "cursor-pointer hover:bg-ds-surface-muted",
                        )}
                        style={{
                          width: column?.width,
                          minWidth: column?.minWidth,
                          maxWidth: column?.maxWidth,
                        }}
                        onClick={canEdit && !isEditing ? handleCellClick : undefined}
                        {...cellProps}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            defaultValue={String(content ?? "")}
                            autoFocus
                            onBlur={(e) => {
                              handleCellChange(e.target.value);
                              editable?.onCancelEdit?.();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleCellChange(e.currentTarget.value);
                                editable?.onCancelEdit?.();
                              } else if (e.key === "Escape") {
                                editable?.onCancelEdit?.();
                              }
                            }}
                            className="w-full rounded border border-ds-border-subtle px-2 py-1 text-sm"
                          />
                        ) : (
                          (content as React.ReactNode)
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={colCount} className={cn("text-center", paddingClass)}>
                <div className="ds-table__empty">{renderEmpty()}</div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── StatusBadge ────────────────────────────────────────────────────────────

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClassName: Record<StatusTone, string> = {
  neutral: "bg-ds-surface-muted text-ds-text-secondary border border-ds-border-subtle",
  info: "bg-ds-info/10 text-ds-info border border-ds-info/20",
  success: "bg-ds-success/10 text-ds-success border border-ds-success/20",
  warning: "bg-ds-warning/10 text-ds-warning border border-ds-warning/30",
  danger: "bg-ds-destructive/10 text-ds-destructive border border-ds-destructive/20",
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: StatusTone;
  className?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}

export function StatusBadge({ tone = "neutral", className, children, icon, ...props }: StatusBadgeProps) {
  const toneClass = toneClassName[tone] || toneClassName.neutral;
  return (
    <Badge
      className={cn(
        "ds-status-badge inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        toneClass,
        className,
      )}
      {...props}
    >
      {icon ? <span className="inline-flex h-3 w-3 items-center justify-center">{icon}</span> : null}
      <span>{children}</span>
    </Badge>
  );
}

// ─── FilterSelect ───────────────────────────────────────────────────────────

interface FilterSelectOption {
  value: string;
  label: string;
  [key: string]: unknown;
}

interface FilterSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options?: FilterSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

const EMPTY_OPTION_VALUE = "__ds_select_empty__";

function toInternalSelectValue(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) {
    return EMPTY_OPTION_VALUE;
  }
  const stringValue = `${raw}`;
  return stringValue === "" ? EMPTY_OPTION_VALUE : stringValue;
}

function toExternalSelectValue(internal: string): string {
  return internal === EMPTY_OPTION_VALUE ? "" : internal;
}

export function FilterSelect({
  value,
  onChange,
  options = [],
  placeholder = "Chọn",
  emptyLabel,
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
}: FilterSelectProps) {
  const internalValue = toInternalSelectValue(value);

  const items = React.useMemo(() => {
    const base = Array.isArray(options)
      ? options.map(item => ({
          ...item,
          value: toInternalSelectValue(item?.value ?? item?.label ?? ""),
        }))
      : [];
    if (emptyLabel) {
      return [{ value: EMPTY_OPTION_VALUE, label: emptyLabel }, ...base];
    }
    return base;
  }, [emptyLabel, options]);

  const handleChange = React.useCallback(
    (nextValue: string) => {
      onChange?.(toExternalSelectValue(nextValue));
    },
    [onChange],
  );

  return (
    <Select value={internalValue} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={cn("ds-select-trigger", triggerClassName, className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn("ds-select-content", contentClassName)}>
        {items.map((item) => (
          <SelectItem key={item.value ?? item.label} value={item.value ?? EMPTY_OPTION_VALUE} className="text-sm">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── AppDialog ──────────────────────────────────────────────────────────────

export const AppDialog = BaseDialog;

type DialogSize = "sm" | "md" | "lg";

const dialogSizeClass: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

interface AppDialogContentProps extends React.ComponentPropsWithoutRef<typeof BaseDialogContent> {
  size?: DialogSize;
}

export const AppDialogContent = React.forwardRef<
  React.ComponentRef<typeof BaseDialogContent>,
  AppDialogContentProps
>(function AppDialogContent({ className, size = "md", ...props }, _ref) {
  const sizeClass = dialogSizeClass[size] || dialogSizeClass.md;
  return (
    <BaseDialogContent
      className={cn("ds-dialog", sizeClass, className)}
      {...props}
    />
  );
});

export const AppDialogHeader = React.forwardRef<
  React.ComponentRef<typeof BaseDialogHeader>,
  React.ComponentPropsWithoutRef<typeof BaseDialogHeader>
>(function AppDialogHeader({ className, ...props }, _ref) {
  return (
    <BaseDialogHeader
      className={cn("ds-dialog__header", className)}
      {...props}
    />
  );
});

export const AppDialogTitle = React.forwardRef<
  React.ComponentRef<typeof BaseDialogTitle>,
  React.ComponentPropsWithoutRef<typeof BaseDialogTitle>
>(function AppDialogTitle({ className, ...props }, _ref) {
  return (
    <BaseDialogTitle
      className={cn("ds-dialog__title", className)}
      {...props}
    />
  );
});

export const AppDialogDescription = React.forwardRef<
  React.ComponentRef<typeof BaseDialogDescription>,
  React.ComponentPropsWithoutRef<typeof BaseDialogDescription>
>(function AppDialogDescription({ className, ...props }, _ref) {
  return (
    <BaseDialogDescription
      className={cn("ds-dialog__description", className)}
      {...props}
    />
  );
});

export const AppDialogFooter = React.forwardRef<
  React.ComponentRef<typeof BaseDialogFooter>,
  React.ComponentPropsWithoutRef<typeof BaseDialogFooter>
>(function AppDialogFooter({ className, ...props }, _ref) {
  return (
    <BaseDialogFooter
      className={cn("ds-dialog__footer", className)}
      {...props}
    />
  );
});

export const AppDialogTrigger = BaseDialogTrigger;
export const AppDialogClose = BaseDialogClose;
