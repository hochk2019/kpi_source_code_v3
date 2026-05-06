import { Button } from "@/components/ui/button.tsx";
import AgencyInput from "@/components/rules-editor/controls/AgencyInput.jsx";
import CodeMultiSelect from "@/components/rules-editor/controls/CodeMultiSelect.jsx";

export default function AgencyExcludeEditor({
  agencies,
  onChange,
  disabled,
  agencyOptions = [],
  codeOptions = [],
}) {
  const list = Array.isArray(agencies) ? agencies : [];

  const updateEntry = (index, key, value) => {
    const next = list.map((entry, idx) =>
      idx === index
        ? {
            ...entry,
            [key]:
              key === "codes"
                ? Array.isArray(value)
                  ? value
                      .map((code) => String(code || "").trim().toUpperCase())
                      .filter(Boolean)
                  : String(value || "")
                      .split(",")
                      .map((code) => code.trim().toUpperCase())
                      .filter(Boolean)
                : String(value || "").trim(),
          }
        : entry
    );
    onChange(next);
  };

  const addEntry = () => {
    onChange([...list, { agency: "", codes: [] }]);
  };

  const deleteEntry = (index) => {
    onChange(list.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-2">
      <div className="font-medium">Loại trừ theo đại lý hải quan</div>
      <div className="text-xs text-gray-500">
        Khi đại lý khớp với tên trong danh sách, các mã giấy phép tương ứng sẽ
        không được cộng điểm.
      </div>
      {list.length === 0 && disabled ? (
        <div className="text-sm text-gray-500">Không có đại lý bị loại trừ.</div>
      ) : (
        <div className="space-y-3">
          {list.map((entry, index) => (
            <div
              key={`${entry.agency || "agency"}-${index}`}
              className="grid gap-2 md:grid-cols-6"
            >
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">Tên đại lý</label>
                <AgencyInput
                  value={entry.agency || ""}
                  onChange={(val) => updateEntry(index, "agency", val)}
                  options={agencyOptions}
                  placeholder="Ví dụ: G&B"
                  disabled={disabled}
                />
              </div>
              <div className="md:col-span-3">
                <label className="text-sm text-gray-600">
                  Mã giấy phép áp dụng
                </label>
                <CodeMultiSelect
                  value={Array.isArray(entry.codes) ? entry.codes : []}
                  onChange={(codes) => updateEntry(index, "codes", codes)}
                  options={codeOptions}
                  disabled={disabled}
                  placeholder="Chọn mã giấy phép"
                  searchPlaceholder="Tìm mã giấy phép"
                  listHeading="Mã giấy phép đã ghi nhận"
                  emptyLabel="Không tìm thấy mã giấy phép phù hợp."
                  addLabel="Thêm mã giấy phép"
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                {!disabled && (
                  <Button
                    variant="outline"
                    onClick={() => deleteEntry(index)}
                    className="w-full"
                  >
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
          Thêm đại lý loại trừ
        </Button>
      )}
    </div>
  );
}
