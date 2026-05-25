import { Button } from "@/components/ui/button.tsx";

import RuleNumberInput from "@/components/rules-editor/controls/RuleNumberInput.jsx";

export default function TierEditor({
  tiers = [],
  onChange,
  disabled = false,
  title = "Bậc cộng thêm",
}) {
  const safeTiers = Array.isArray(tiers) ? tiers : [];

  const handleAdd = () => {
    onChange([...safeTiers, { from: 11, to: 20, add: 0.5 }]);
  };

  const handleDelete = (index) => {
    onChange(safeTiers.filter((_, idx) => idx !== index));
  };

  const handleChange = (index, key, value) => {
    onChange(
      safeTiers.map((tier, idx) =>
        idx === index ? { ...tier, [key]: value } : tier
      )
    );
  };

  if (!safeTiers.length && disabled) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="font-medium">{title}</div>
      <div className="grid grid-cols-12 gap-2 items-center text-sm font-medium">
        <div className="col-span-3">Từ</div>
        <div className="col-span-3">Đến</div>
        <div className="col-span-3">Cộng (+)</div>
        <div className="col-span-3" />
      </div>
      {safeTiers.map((tier, index) => (
        <div
          key={`${index}-${tier.from}-${tier.to}`}
          className="grid grid-cols-12 gap-2 items-center"
        >
          <div className="col-span-3">
            <RuleNumberInput
              step="1"
              value={tier.from}
              onChange={(val) => handleChange(index, "from", val)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-3">
            <RuleNumberInput
              step="1"
              value={tier.to}
              onChange={(val) => handleChange(index, "to", val)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-3">
            <RuleNumberInput
              value={tier.add}
              onChange={(val) => handleChange(index, "add", val)}
              disabled={disabled}
            />
          </div>
          <div className="col-span-3">
            {!disabled && (
              <Button variant="outline" onClick={() => handleDelete(index)}>
                Xóa
              </Button>
            )}
          </div>
        </div>
      ))}
      {!disabled && (
        <Button variant="outline" onClick={handleAdd}>
          Thêm bậc
        </Button>
      )}
    </div>
  );
}
