import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.js";

import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

export default function CodeMultiSelect({
  value = [],
  onChange,
  options = [],
  disabled = false,
  placeholder = "Chọn mã loại hình",
  searchPlaceholder = "Tìm mã loại hình",
  listHeading = "Mã loại hình đã đồng bộ",
  emptyLabel = "Không tìm thấy mã phù hợp.",
  addLabel = "Thêm mã",
}) {
  const selected = useMemo(() => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((code) => String(code || "").trim().toUpperCase())
      .filter(Boolean);
  }, [value]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const normalizedOptions = useMemo(() => {
    return options
      .map((item) => ({
        value: String(item?.value || "").trim().toUpperCase(),
        count: Number.isFinite(item?.count) ? Number(item.count) : 0,
        label: item?.label || "",
      }))
      .filter((item) => item.value)
      .reduce((list, item) => {
        if (list.some((entry) => entry.value === item.value)) return list;
        return [...list, item];
      }, [])
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.value.localeCompare(b.value);
      });
  }, [options]);

  const handleToggle = useCallback(
    (code) => {
      if (disabled) return;
      const upper = String(code || "").trim().toUpperCase();
      if (!upper) return;
      const next = selected.includes(upper)
        ? selected.filter((item) => item !== upper)
        : [...selected, upper];
      onChange?.(next.sort((a, b) => a.localeCompare(b)));
    },
    [disabled, onChange, selected]
  );

  const handleAddCustom = useCallback(() => {
    if (disabled) return;
    const upper = search.trim().toUpperCase();
    if (!upper) return;
    if (selected.includes(upper)) {
      setOpen(false);
      return;
    }
    onChange?.([...selected, upper].sort((a, b) => a.localeCompare(b)));
    setSearch("");
    setOpen(false);
  }, [disabled, onChange, search, selected]);

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const canAddCustom = useMemo(() => {
    const upper = search.trim().toUpperCase();
    if (!upper) return false;
    if (selected.includes(upper)) return false;
    return !normalizedOptions.some((item) => item.value === upper);
  }, [normalizedOptions, search, selected]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate text-left">
              {selected.length ? `${selected.length} mã đã chọn` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
            />
            <CommandList className="max-h-64 overflow-y-auto">
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              {canAddCustom ? (
                <CommandGroup heading="Thêm mới">
                  <CommandItem value={search} onSelect={handleAddCustom}>
                    <Plus className="mr-2 size-4" />
                    {addLabel} "{search.trim().toUpperCase()}"
                  </CommandItem>
                </CommandGroup>
              ) : null}
              <CommandGroup heading={listHeading}>
                {normalizedOptions.map((item) => {
                  const isSelected = selected.includes(item.value);
                  return (
                    <CommandItem
                      key={item.value}
                      value={`${item.value} ${item.label}`.trim()}
                      onSelect={() => handleToggle(item.value)}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-1 flex-col">
                        <span className="font-medium">{item.value}</span>
                        {item.label ? (
                          <span className="text-xs text-muted-foreground">
                            {item.label}
                          </span>
                        ) : null}
                      </div>
                      {item.count ? (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {item.count.toLocaleString("vi-VN")} tờ
                        </span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((code) => (
            <Badge
              key={code}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {code}
              {!disabled && (
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground transition hover:bg-white hover:text-red-600"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleToggle(code);
                  }}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Chưa chọn mã nào.</div>
      )}
    </div>
  );
}
