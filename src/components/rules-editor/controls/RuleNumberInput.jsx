export default function RuleNumberInput({
  value,
  onChange,
  step = "0.1",
  disabled = false,
}) {
  const display = value === 0 ? 0 : value ?? "";

  return (
    <input
      type="number"
      step={step}
      value={display}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "") {
          onChange("");
          return;
        }
        const parsed = Number(raw);
        onChange(Number.isFinite(parsed) ? parsed : 0);
      }}
      className="w-full rounded border p-2"
    />
  );
}
