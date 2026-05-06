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
  headerClassName?: string;
  cellClassName?: string;
  headProps?: Record<string, unknown>;
  cellProps?: Record<string, unknown>;
  renderHeader?: (column: DataTableColumn<T>) => React.ReactNode;
  cell?: (item: T, index: number) => React.ReactNode;
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
}: DataTableProps<T>) {
  const paddingClass = densityPadding[density] || densityPadding.comfortable;

  const resolvedRowKey =
    typeof rowKey === "function"
      ? rowKey
      : (item: T, index: number) =>
          typeof rowKey === "string" && item && item[rowKey] != null
            ? `${rowKey}:${item[rowKey]}`
            : `row-${index}`;

  const renderEmpty = () => {
    if (typeof emptyState === "function") {
      return emptyState();
    }
    return <div>{emptyState}</div>;
  };

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
            {columns.map((column) => {
              const headProps = column?.headProps || {};
              const alignClass =
                column.align === "right"
                  ? "text-right"
                  : column.align === "center"
                    ? "text-center"
                    : "text-left";
              return (
                <TableHead
                  key={column.key || column.id || column.accessor || String(column.label)}
                  className={cn(
                    "ds-table__head",
                    alignClass,
                    paddingClass,
                    column?.headerClassName,
                  )}
                  style={column?.width ? { width: column.width } : undefined}
                  {...headProps}
                >
                  {column.renderHeader ? column.renderHeader(column) : column.label}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody className={cn("ds-table__body", bodyClassName)}>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className={cn("text-center text-[color:var(--ds-text-muted)]", paddingClass)}>
                Đang tải dữ liệu…
              </TableCell>
            </TableRow>
          ) : data && data.length > 0 ? (
            data.map((item, index) => {
              const key = resolvedRowKey(item, index);
              const rowClassName = cn(
                "align-top",
                zebra && index % 2 === 1 && "ds-table__row--zebra",
                (item as Record<string, unknown>)?.rowClassName as string | undefined,
              );
              return (
                <TableRow key={key} className={rowClassName} data-row-index={index}>
                  {columns.map((column) => {
                    const cellProps = column?.cellProps || {};
                    const alignClass =
                      column.align === "right"
                        ? "text-right"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left";
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
                        )}
                        style={column?.width ? { width: column.width } : undefined}
                        {...cellProps}
                      >
                        {content as React.ReactNode}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className={cn("text-center", paddingClass)}>
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
  neutral:
    "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-200 dark:border-slate-700",
  info:
    "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-500/40",
  success:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-50",
  warning:
    "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-500/40",
  danger:
    "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-500/40",
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
