import React from "react";
import { cn } from "@/lib/utils.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.jsx";
import {
  Dialog as BaseDialog,
  DialogContent as BaseDialogContent,
  DialogDescription as BaseDialogDescription,
  DialogFooter as BaseDialogFooter,
  DialogHeader as BaseDialogHeader,
  DialogTitle as BaseDialogTitle,
  DialogTrigger as BaseDialogTrigger,
  DialogClose as BaseDialogClose,
} from "@/components/ui/dialog.jsx";

const densityPadding = {
  compact: "py-2",
  comfortable: "py-2.5",
  relaxed: "py-3.5",
};

export function DataTable({
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
}) {
  const paddingClass = densityPadding[density] || densityPadding.comfortable;
  const resolvedRowKey =
    typeof rowKey === "function"
      ? rowKey
      : (item, index) =>
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
      <Table className={cn("ds-table", stickyHeader && "ds-table--sticky")}>
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
                  key={column.key || column.id || column.accessor || column.label}
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
                item?.rowClassName,
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
                        : item?.[column.key];
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
                        {content}
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

const toneClassName = {
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

export function StatusBadge({ tone = "neutral", className, children, icon, ...props }) {
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
}) {
  const normalizedValue = value ?? "";
  const items = React.useMemo(() => {
    if (emptyLabel) {
      return [{ value: "", label: emptyLabel }, ...options];
    }
    return options;
  }, [emptyLabel, options]);

  return (
    <Select value={normalizedValue} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("ds-select-trigger", triggerClassName, className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn("ds-select-content", contentClassName)}>
        {items.map((item) => (
          <SelectItem key={item.value ?? item.label} value={item.value ?? ""} className="text-sm">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const AppDialog = BaseDialog;

const dialogSizeClass = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export const AppDialogContent = React.forwardRef(function AppDialogContent(
  { className, size = "md", ...props },
  ref,
) {
  const sizeClass = dialogSizeClass[size] || dialogSizeClass.md;
  return (
    <BaseDialogContent
      ref={ref}
      className={cn("ds-dialog", sizeClass, className)}
      {...props}
    />
  );
});

export const AppDialogHeader = React.forwardRef(function AppDialogHeader(
  { className, ...props },
  ref,
) {
  return (
    <BaseDialogHeader
      ref={ref}
      className={cn("ds-dialog__header", className)}
      {...props}
    />
  );
});

export const AppDialogTitle = React.forwardRef(function AppDialogTitle(
  { className, ...props },
  ref,
) {
  return (
    <BaseDialogTitle
      ref={ref}
      className={cn("ds-dialog__title", className)}
      {...props}
    />
  );
});

export const AppDialogDescription = React.forwardRef(function AppDialogDescription(
  { className, ...props },
  ref,
) {
  return (
    <BaseDialogDescription
      ref={ref}
      className={cn("ds-dialog__description", className)}
      {...props}
    />
  );
});

export const AppDialogFooter = React.forwardRef(function AppDialogFooter(
  { className, ...props },
  ref,
) {
  return (
    <BaseDialogFooter
      ref={ref}
      className={cn("ds-dialog__footer", className)}
      {...props}
    />
  );
});

export const AppDialogTrigger = BaseDialogTrigger;
export const AppDialogClose = BaseDialogClose;
