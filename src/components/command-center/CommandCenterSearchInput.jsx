import React from 'react';

import { SearchField } from '@/components/designSystem/shellPrimitives.jsx';

export default function CommandCenterSearchInput({
  inputRef,
  query,
  onChange,
  onKeyDown,
}) {
  return (
    <SearchField
      ref={inputRef}
      label="Tìm thao tác trong Command Center"
      hideLabel
      value={query}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder="Tìm chức năng, biểu đồ, tài liệu hoặc thao tác..."
      className="flex-1"
      controlClassName="min-h-0 border-0 bg-transparent px-0"
      trailingContent={
        <span className="hidden text-xs text-gray-400 sm:inline-flex sm:items-center sm:gap-1">
          <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
            Ctrl
          </kbd>
          +
          <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
            K
          </kbd>
        </span>
      }
    />
  );
}
