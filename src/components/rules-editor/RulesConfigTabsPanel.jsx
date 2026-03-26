import React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import AgencyExcludeEditor from "@/components/rules-editor/controls/AgencyExcludeEditor.jsx";
import CodeMultiSelect from "@/components/rules-editor/controls/CodeMultiSelect.jsx";
import LicensePointTable from "@/components/rules-editor/controls/LicensePointTable.jsx";
import RuleNumberInput from "@/components/rules-editor/controls/RuleNumberInput.jsx";
import TierEditor from "@/components/rules-editor/controls/TierEditor.jsx";
import { InfoIcon } from "lucide-react";

export default function RulesConfigTabsPanel({
  configTab,
  onConfigTabChange,
  groups,
  typeOptions,
  isReadOnly,
  onGroupCodesChange,
  onGroupNumberChange,
  licenseConfig,
  onLicenseChange,
  licenseOptions,
  onAgencyChange,
  agencyOptions,
  rule,
  onRuleChange,
}) {
  const handleBonusCoChange = (patch) => {
    onRuleChange({
      ...rule,
      bonuses: {
        ...rule?.bonuses,
        co: {
          ...rule?.bonuses?.co,
          ...patch,
        },
      },
    });
  };

  const bonusCoEnabled = rule?.bonuses?.co?.enabled ?? false;

  return (
    <Tabs value={configTab} onValueChange={onConfigTabChange} className="space-y-4">
      <TabsList className="grid gap-2 sm:w-auto sm:grid-cols-3">
        <TabsTrigger value="groups">Nhóm loại hình</TabsTrigger>
        <TabsTrigger value="license">Giấy phép &amp; loại trừ</TabsTrigger>
        <TabsTrigger value="bonus">Điểm cộng thêm</TabsTrigger>
      </TabsList>

      <TabsContent value="groups">
        <div className="grid gap-6 md:grid-cols-3">
          {Object.entries(groups).map(([groupKey, groupConfig]) => (
            <div key={groupKey} className="space-y-3 rounded border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{groupConfig.title || groupKey}</div>
                  {groupConfig.description && (
                    <div className="text-xs text-gray-500">{groupConfig.description}</div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600">Mã loại hình</label>
                <CodeMultiSelect
                  value={groupConfig.codes || []}
                  onChange={(codes) => onGroupCodesChange(groupKey, codes)}
                  options={typeOptions}
                  disabled={isReadOnly}
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Điểm cơ bản mỗi tờ khai</label>
                <RuleNumberInput
                  value={groupConfig.base}
                  onChange={(val) => onGroupNumberChange(groupKey, "base", val)}
                  disabled={isReadOnly}
                />
              </div>

              <div>
                <label className="text-sm text-gray-600">Điểm cộng theo mỗi mục hàng</label>
                <RuleNumberInput
                  value={groupConfig.perItem}
                  onChange={(val) => onGroupNumberChange(groupKey, "perItem", val)}
                  disabled={isReadOnly}
                />
              </div>

              {groupConfig.perItem === 0 && groupConfig.tiers?.length ? (
                <div className="rounded border border-dashed p-2">
                  <div className="mb-2 text-xs text-gray-500">
                    Nhóm này đang sử dụng cấu hình bậc thay vì điểm theo mục hàng.
                  </div>
                  <TierEditor
                    tiers={groupConfig.tiers}
                    onChange={(nextTiers) => onGroupNumberChange(groupKey, "tiers", nextTiers)}
                    disabled={isReadOnly}
                    title="Các bậc cộng thêm"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="license">
        <div className="space-y-3 rounded border p-3">
          <div className="font-semibold">Cấu hình điểm giấy phép</div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm text-gray-600">Điểm mặc định mỗi loại giấy phép</label>
              <RuleNumberInput
                value={licenseConfig.defaultPoints}
                onChange={(val) =>
                  onLicenseChange({
                    ...licenseConfig,
                    defaultPoints: val,
                  })
                }
                disabled={isReadOnly}
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Các mã giấy phép bị loại trừ</label>
              <CodeMultiSelect
                value={licenseConfig.exclude?.codes || []}
                onChange={(codes) =>
                  onLicenseChange({
                    ...licenseConfig,
                    exclude: {
                      ...licenseConfig.exclude,
                      codes,
                      agencies: licenseConfig.exclude?.agencies || [],
                    },
                  })
                }
                options={licenseOptions}
                disabled={isReadOnly}
                placeholder="Chọn mã giấy phép"
                searchPlaceholder="Tìm mã giấy phép"
                listHeading="Mã giấy phép đã ghi nhận"
                emptyLabel="Không tìm thấy mã giấy phép phù hợp."
                addLabel="Thêm mã giấy phép"
              />
            </div>
          </div>

          <LicensePointTable
            config={licenseConfig}
            onChange={(next) => onLicenseChange(next)}
            disabled={isReadOnly}
            options={licenseOptions}
          />

          <AgencyExcludeEditor
            agencies={licenseConfig.exclude?.agencies || []}
            onChange={onAgencyChange}
            disabled={isReadOnly}
            agencyOptions={agencyOptions}
            codeOptions={licenseOptions}
          />
        </div>
      </TabsContent>

      <TabsContent value="bonus">
        <div className="space-y-3 rounded border p-3">
          <div className="font-semibold">Điểm cộng thêm</div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={bonusCoEnabled}
              onChange={(event) => handleBonusCoChange({ enabled: event.target.checked })}
              disabled={isReadOnly}
            />
            Cộng điểm khi tờ khai có C/O
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm text-gray-600">Điểm cộng mỗi tờ khai có C/O</label>
              <RuleNumberInput
                value={rule?.bonuses?.co?.points ?? 0}
                onChange={(val) => handleBonusCoChange({ points: val })}
                disabled={isReadOnly || !bonusCoEnabled}
              />
            </div>

            <div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <span>Điểm cộng mỗi dòng áp C/O</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:text-gray-700"
                      aria-label="Giải thích cách tính điểm C/O theo dòng"
                    >
                      <InfoIcon className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs leading-relaxed">
                    Điểm thưởng C/O = số dòng hàng áp C/O × giá trị cấu hình tại đây. Ví dụ: 5
                    dòng và mỗi dòng 0.05 điểm sẽ được cộng thêm 0.25 điểm.
                  </TooltipContent>
                </Tooltip>
              </div>

              <RuleNumberInput
                value={rule?.bonuses?.co?.perLine ?? 0}
                onChange={(val) => handleBonusCoChange({ perLine: val })}
                disabled={isReadOnly || !bonusCoEnabled}
              />
              <div className="mt-1 text-xs text-gray-500">
                Điểm này nhân với số dòng hàng áp C/O trong tờ khai.
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
