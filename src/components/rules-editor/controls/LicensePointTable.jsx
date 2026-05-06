import { Button } from "@/components/ui/button.tsx";
import LicenseCodeInput from "@/components/rules-editor/controls/LicenseCodeInput.jsx";
import RuleNumberInput from "@/components/rules-editor/controls/RuleNumberInput.jsx";

export default function LicensePointTable({
  config,
  onChange,
  disabled,
  options = [],
}) {
  const entries = Array.isArray(config?.codePoints) ? config.codePoints : [];

  const updateEntry = (index, key, value) => {
    const next = entries.map((entry, idx) =>
      idx === index
        ? {
            ...entry,
            [key]:
              key === "code"
                ? String(value || "").trim().toUpperCase()
                : value,
          }
        : entry
    );
    onChange({ ...config, codePoints: next });
  };

  const addEntry = () => {
    onChange({
      ...config,
      codePoints: [...entries, { code: "", points: config?.defaultPoints ?? 0 }],
    });
  };

  const deleteEntry = (index) => {
    onChange({
      ...config,
      codePoints: entries.filter((_, idx) => idx !== index),
    });
  };

  return (
    <div className="space-y-2">
      <div className="font-medium">Điểm theo từng mã giấy phép</div>
      {entries.length === 0 && disabled ? (
        <div className="text-sm text-gray-500">
          Không có cấu hình riêng cho mã giấy phép.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div
              key={`${entry.code}-${index}`}
              className="grid grid-cols-12 gap-2 items-center"
            >
              <div className="col-span-6">
                <LicenseCodeInput
                  value={entry.code || ""}
                  onChange={(nextValue) => updateEntry(index, "code", nextValue)}
                  options={options}
                  placeholder="Ví dụ: ZB02"
                  disabled={disabled}
                />
              </div>
              <div className="col-span-4">
                <RuleNumberInput
                  value={entry.points}
                  onChange={(val) => updateEntry(index, "points", val)}
                  disabled={disabled}
                />
              </div>
              <div className="col-span-2">
                {!disabled && (
                  <Button variant="outline" onClick={() => deleteEntry(index)}>
                    Xóa
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!disabled && (
        <Button variant="outline" onClick={addEntry}>
          Thêm mã giấy phép
        </Button>
      )}
    </div>
  );
}
