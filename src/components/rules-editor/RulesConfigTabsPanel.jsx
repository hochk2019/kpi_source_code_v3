import React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.jsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.jsx";
import AgencyExcludeEditor from "@/components/rules-editor/controls/AgencyExcludeEditor.jsx";
import CodeMultiSelect from "@/components/rules-editor/controls/CodeMultiSelect.jsx";
import LicensePointTable from "@/components/rules-editor/controls/LicensePointTable.jsx";
import RuleNumberInput from "@/components/rules-editor/controls/RuleNumberInput.jsx";
import TierEditor from "@/components/rules-editor/controls/TierEditor.jsx";
import { InfoIcon, PencilIcon, CheckIcon } from "lucide-react";
import { useState } from "react";

function ConfigGroupCard({ groupKey, groupConfig, typeOptions, isReadOnly, onGroupCodesChange, onGroupNumberChange }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={`transition-all rounded-xl border p-4 ${isEditing ? "bg-white shadow-md ring-1 ring-blue-500" : "bg-white/60 backdrop-blur-md shadow-sm"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-gray-900">{groupConfig.title || groupKey}</div>
          {groupConfig.description && !isEditing && (
            <div className="text-xs text-gray-500 mt-1 line-clamp-1">{groupConfig.description}</div>
          )}
        </div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${isEditing ? "bg-blue-100 text-blue-600 hover:bg-blue-200" : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"
              }`}
            title={isEditing ? "Hoàn tất chỉnh sửa" : "Chỉnh sửa quy tắc"}
          >
            {isEditing ? <CheckIcon className="h-4 w-4" /> : <PencilIcon className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-2 gap-2 text-sm mt-4">
          <div className="rounded bg-gray-50/80 p-2 text-center pointer-events-none">
            <div className="text-xs text-gray-500 mb-0.5">Cơ bản</div>
            <div className="font-semibold text-blue-600">{groupConfig.base} đ</div>
          </div>
          <div className="rounded bg-gray-50/80 p-2 text-center pointer-events-none">
            <div className="text-xs text-gray-500 mb-0.5">Mục hàng</div>
            <div className="font-semibold text-emerald-600">
              {groupConfig.perItem === 0 && groupConfig.tiers?.length ? "Theo bậc" : `${groupConfig.perItem} đ`}
            </div>
          </div>
          <div className="col-span-2 rounded bg-gray-50/80 p-2 flex items-center justify-between text-xs mt-1 pointer-events-none">
            <span className="text-gray-500">Mã loại hình áp dụng</span>
            <span className="font-medium text-gray-700">{groupConfig.codes?.length || 0} mã</span>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          {groupConfig.description && (
            <div className="text-xs text-gray-500"><InfoIcon className="inline h-3.5 w-3.5 mr-1" />{groupConfig.description}</div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700">Mã loại hình</label>
            <CodeMultiSelect value={groupConfig.codes || []} onChange={(codes) => onGroupCodesChange(groupKey, codes)} options={typeOptions} disabled={isReadOnly} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Điểm cơ bản</label>
              <RuleNumberInput value={groupConfig.base} onChange={(val) => onGroupNumberChange(groupKey, "base", val)} disabled={isReadOnly} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Điểm mục hàng</label>
              <RuleNumberInput value={groupConfig.perItem} onChange={(val) => onGroupNumberChange(groupKey, "perItem", val)} disabled={isReadOnly} />
            </div>
          </div>
          {groupConfig.perItem === 0 && groupConfig.tiers?.length ? (
            <div className="rounded border border-dashed border-gray-200 p-3 bg-gray-50/50">
              <div className="mb-2 text-xs text-gray-500">Nhóm này đang sử dụng cấu hình bậc thay vì điểm theo mục hàng.</div>
              <TierEditor tiers={groupConfig.tiers} onChange={(nextTiers) => onGroupNumberChange(groupKey, "tiers", nextTiers)} disabled={isReadOnly} title="Các bậc cộng thêm" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ConfigLicenseCard({ licenseConfig, onLicenseChange, licenseOptions, agencyOptions, onAgencyChange, isReadOnly }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={`transition-all rounded-xl border p-4 ${isEditing ? "bg-white shadow-md ring-1 ring-blue-500" : "bg-white/60 backdrop-blur-md shadow-sm"}`}>
      <div className="flex items-start justify-between">
        <div className="font-semibold text-gray-900">Giấy phép & loại trừ</div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${isEditing ? "bg-blue-100 text-blue-600 hover:bg-blue-200" : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"
              }`}
            title={isEditing ? "Hoàn tất chỉnh sửa" : "Chỉnh sửa cấu hình giấy phép"}
          >
            {isEditing ? <CheckIcon className="h-4 w-4" /> : <PencilIcon className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-3 gap-2 text-sm mt-4">
          <div className="rounded bg-gray-50/80 p-2 text-center pointer-events-none">
            <div className="text-xs text-gray-500 mb-0.5">Điểm mặc định</div>
            <div className="font-semibold text-blue-600">{licenseConfig.defaultPoints} đ</div>
          </div>
          <div className="rounded bg-gray-50/80 p-2 text-center pointer-events-none">
            <div className="text-xs text-gray-500 mb-0.5">Loại trừ mã</div>
            <div className="font-medium text-gray-700">{licenseConfig.exclude?.codes?.length || 0} mã</div>
          </div>
          <div className="rounded bg-gray-50/80 p-2 text-center pointer-events-none">
            <div className="text-xs text-gray-500 mb-0.5">Loại trừ HQ</div>
            <div className="font-medium text-gray-700">{licenseConfig.exclude?.agencies?.length || 0} đơn vị</div>
          </div>
          <div className="col-span-3 rounded bg-gray-50/80 p-2 flex items-center justify-between text-xs mt-1 pointer-events-none">
            <span className="text-gray-500">Các chứng từ tùy chỉnh điểm</span>
            <span className="font-medium text-gray-700">{Object.keys(licenseConfig.customPoints || {}).length} loại</span>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-6 border-t border-gray-100 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Điểm mặc định mỗi loại giấy phép</label>
              <RuleNumberInput value={licenseConfig.defaultPoints} onChange={(val) => onLicenseChange({ ...licenseConfig, defaultPoints: val })} disabled={isReadOnly} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700">Các mã giấy phép bị loại trừ</label>
              <CodeMultiSelect value={licenseConfig.exclude?.codes || []} onChange={(codes) => onLicenseChange({ ...licenseConfig, exclude: { ...licenseConfig.exclude, codes, agencies: licenseConfig.exclude?.agencies || [] } })} options={licenseOptions} disabled={isReadOnly} placeholder="Chọn giấy phép" searchPlaceholder="Tìm mã giấy phép" listHeading="Mã đã ghi nhận" emptyLabel="Không có." addLabel="Thêm" />
            </div>
          </div>
          <LicensePointTable config={licenseConfig} onChange={(next) => onLicenseChange(next)} disabled={isReadOnly} options={licenseOptions} />
          <AgencyExcludeEditor agencies={licenseConfig.exclude?.agencies || []} onChange={onAgencyChange} disabled={isReadOnly} agencyOptions={agencyOptions} codeOptions={licenseOptions} />
        </div>
      )}
    </div>
  );
}

function ConfigBonusCard({ rule, handleBonusCoChange, isReadOnly, bonusCoEnabled }) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={`transition-all rounded-xl border p-4 ${isEditing ? "bg-white shadow-md ring-1 ring-blue-500" : "bg-white/60 backdrop-blur-md shadow-sm"}`}>
      <div className="flex items-start justify-between">
        <div className="font-semibold text-gray-900">Điểm cộng bù C/O</div>
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${isEditing ? "bg-blue-100 text-blue-600 hover:bg-blue-200" : "text-gray-400 hover:bg-gray-100 hover:text-gray-900"
              }`}
            title={isEditing ? "Hoàn tất chỉnh sửa" : "Chỉnh sửa cấu hình cộng điểm"}
          >
            {isEditing ? <CheckIcon className="h-4 w-4" /> : <PencilIcon className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-2 gap-2 text-sm mt-4">
          {bonusCoEnabled ? (
            <>
              <div className="rounded bg-gray-50/80 p-2 text-center pointer-events-none">
                <div className="text-xs text-gray-500 mb-0.5">Cộng trên tờ khai</div>
                <div className="font-semibold text-blue-600">+{rule?.bonuses?.co?.points ?? 0} đ</div>
              </div>
              <div className="rounded bg-gray-50/80 p-2 text-center pointer-events-none">
                <div className="text-xs text-gray-500 mb-0.5">Cộng mỗi dòng</div>
                <div className="font-semibold text-purple-600">+{rule?.bonuses?.co?.perLine ?? 0} đ</div>
              </div>
            </>
          ) : (
            <div className="col-span-2 rounded bg-gray-100 p-3 text-center text-gray-500 text-xs shadow-inner">
              Bù C/O bị tắt
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
            <input type="checkbox" checked={bonusCoEnabled} onChange={(event) => handleBonusCoChange({ enabled: event.target.checked })} disabled={isReadOnly} />
            Kích hoạt điểm bù theo C/O
          </label>
          {bonusCoEnabled && (
            <div className="grid gap-4 md:grid-cols-2 mt-2 p-4 rounded bg-gray-50/50 border border-gray-200">
              <div>
                <label className="text-sm font-medium text-gray-700">Cộng tổng tờ khai</label>
                <RuleNumberInput value={rule?.bonuses?.co?.points ?? 0} onChange={(val) => handleBonusCoChange({ points: val })} disabled={isReadOnly} />
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
                  <span>Cộng mỗi dòng áp C/O</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex h-4 w-4 text-gray-400 hover:text-blue-500"><InfoIcon className="h-4 w-4" /></button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">Chỉ nhân với các dòng đã khai báo C/O hợp lệ.</TooltipContent>
                  </Tooltip>
                </div>
                <RuleNumberInput value={rule?.bonuses?.co?.perLine ?? 0} onChange={(val) => handleBonusCoChange({ perLine: val })} disabled={isReadOnly} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(groups).map(([groupKey, groupConfig]) => (
            <ConfigGroupCard
              key={groupKey}
              groupKey={groupKey}
              groupConfig={groupConfig}
              typeOptions={typeOptions}
              isReadOnly={isReadOnly}
              onGroupCodesChange={onGroupCodesChange}
              onGroupNumberChange={onGroupNumberChange}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="license">
        <ConfigLicenseCard
          licenseConfig={licenseConfig}
          onLicenseChange={onLicenseChange}
          licenseOptions={licenseOptions}
          agencyOptions={agencyOptions}
          onAgencyChange={onAgencyChange}
          isReadOnly={isReadOnly}
        />
      </TabsContent>

      <TabsContent value="bonus">
        <ConfigBonusCard
          rule={rule}
          handleBonusCoChange={handleBonusCoChange}
          isReadOnly={isReadOnly}
          bonusCoEnabled={bonusCoEnabled}
        />
      </TabsContent>
    </Tabs>
  );
}
