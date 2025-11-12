import PropTypes from "prop-types";

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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
      <div className="flex flex-1 flex-wrap items-end gap-4">
        <div className="min-w-[180px] flex-1 sm:flex-initial">
          <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]">
            Khoảng thời gian
          </label>
          <select
            className="mt-1 w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
            value={quickRange}
            onChange={(event) => onQuickRangeChange(event.target.value)}
          >
            {quickRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px]">
          <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]">
            Từ ngày
          </label>
          <input
            type="date"
            className="mt-1 w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </div>

        <div className="min-w-[160px]">
          <label className="text-xs font-semibold uppercase text-[color:var(--ds-text-secondary)]">
            Đến ngày
          </label>
          <input
            type="date"
            className="mt-1 w-full rounded border border-[color:var(--ds-border-subtle)] bg-[color:var(--ds-surface-card)] px-3 py-2 text-sm text-[color:var(--ds-text-primary)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ds-accent-ring)] focus:ring-offset-0"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
          />
        </div>
      </div>

      {summaryLabel ? (
        <div className="flex items-center justify-end text-xs text-[color:var(--ds-text-secondary)]">
          <span className="rounded-full bg-[color:var(--ds-surface-muted)] px-3 py-1 font-semibold uppercase tracking-wide">
            {summaryLabel}
          </span>
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
