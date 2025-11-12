import PropTypes from "prop-types";

import { Label } from "@/components/ui/label.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.jsx";

function ReportFilterBar({
  quickRange,
  quickRangeOptions,
  onQuickRangeChange,
  from,
  to,
  onFromChange,
  onToChange,
  summaryLabel,
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,240px)_repeat(2,minmax(0,200px))]">
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="report-filter-quick-range"
            className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]"
          >
            Khoảng thời gian
          </Label>
          <Select value={quickRange} onValueChange={onQuickRangeChange}>
            <SelectTrigger
              id="report-filter-quick-range"
              className="h-10 justify-between rounded-lg border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:ring-[color:var(--ds-accent-ring)]"
            >
              <SelectValue aria-label="Khoảng thời gian" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {quickRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="report-filter-from"
            className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]"
          >
            Từ ngày
          </Label>
          <Input
            id="report-filter-from"
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            className="h-10 rounded-lg border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:ring-[color:var(--ds-accent-ring)]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="report-filter-to"
            className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]"
          >
            Đến ngày
          </Label>
          <Input
            id="report-filter-to"
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            className="h-10 rounded-lg border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:ring-[color:var(--ds-accent-ring)]"
          />
        </div>
      </div>

      {summaryLabel ? (
        <div className="flex items-end justify-end">
          <Badge
            variant="secondary"
            className="ds-pill whitespace-nowrap border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-muted)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--ds-text-secondary)]"
          >
            {summaryLabel}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}

ReportFilterBar.propTypes = {
  quickRange: PropTypes.string.isRequired,
  quickRangeOptions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    })
  ).isRequired,
  onQuickRangeChange: PropTypes.func.isRequired,
  from: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
  onFromChange: PropTypes.func.isRequired,
  onToChange: PropTypes.func.isRequired,
  summaryLabel: PropTypes.string,
};

ReportFilterBar.defaultProps = {
  summaryLabel: "",
};

export default ReportFilterBar;
