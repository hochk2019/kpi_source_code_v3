import React, { useEffect, useMemo, useState } from "react";

import SharedStaffCombobox from "@/components/shared/StaffCombobox.tsx";
import { normalizeName, normalizeStr } from "@/lib/storeCoreHelpers.js";
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
import { Check, ChevronsUpDown, CircleX, Plus } from "lucide-react";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function useResetSearch(open, setSearch) {
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open, setSearch]);
}

export function StaffCombobox(props) {
  return (
    <SharedStaffCombobox
      {...props}
      allowCustom
      buttonClassName="w-36 justify-between px-2 py-0 text-left font-normal"
      popoverClassName="w-64 p-0"
    />
  );
}

export function TeamCombobox({ value, onSelect, teams, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useResetSearch(open, setSearch);

  const normalizedValue = normalizeStr(value);
  const normalizedKey = normalizeName(normalizedValue);
  const existingKeys = useMemo(() => new Set(teams.map((team) => team.normalized)), [teams]);
  const searchValue = normalizeStr(search);
  const searchKey = normalizeName(searchValue);
  const canCreateCustom = Boolean(searchKey) && !existingKeys.has(searchKey);

  const handleSelect = (teamName) => {
    onSelect?.({ teamName });
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-28 justify-between px-2 py-0 text-left font-normal"
        >
          <span className="truncate">{normalizedValue || "Chọn tổ đội"}</span>
          <ChevronsUpDown className="ml-2 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Tìm tổ đội"
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>Không có tổ đội phù hợp.</CommandEmpty>
            {normalizedValue ? (
              <CommandGroup heading="Tùy chọn">
                <CommandItem value="__clear__" onSelect={() => handleSelect("")}>
                  <CircleX className="mr-2 size-4" />
                  Bỏ chọn tổ đội
                </CommandItem>
              </CommandGroup>
            ) : null}
            {canCreateCustom ? (
              <CommandGroup heading="Thêm mới">
                <CommandItem value={searchValue} onSelect={() => handleSelect(searchValue)}>
                  <Plus className="mr-2 size-4" />
                  Dùng giá trị "{searchValue}"
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Danh sách tổ đội">
              {teams.map((team) => {
                const isSelected = team.normalized === normalizedKey;
                return (
                  <CommandItem
                    key={team.id}
                    value={team.name}
                    onSelect={() => handleSelect(team.name)}
                  >
                    <Check
                      className={`mr-2 size-4 ${isSelected ? "opacity-100" : "opacity-0"}`}
                    />
                    <span className="truncate">{team.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AgencyCombobox({
  value,
  onSelect,
  options = [],
  disabled = false,
  placeholder = "Chọn đại lý",
  fullWidth = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useResetSearch(open, setSearch);

  const normalizedValue = normalizeStr(value);
  const normalizedKey = normalizeName(normalizedValue);

  const normalizedOptions = useMemo(() => {
    const optionMap = new Map();
    options.forEach((option) => {
      if (!option && option !== 0) return;
      const rawValue = normalizeStr(option?.value ?? option);
      if (!rawValue) return;
      const label = option?.label ? normalizeStr(option.label) : rawValue;
      const hint = option?.hint ? normalizeStr(option.hint) : "";
      const key = normalizeName(rawValue);
      if (!key) return;
      const existing = optionMap.get(key);
      if (existing) {
        if (hint && existing.hints.length < 3 && !existing.hints.includes(hint)) {
          existing.hints.push(hint);
        }
        return;
      }
      optionMap.set(key, {
        key,
        value: rawValue,
        label: label || rawValue,
        hints: hint ? [hint] : [],
      });
    });

    return Array.from(optionMap.values())
      .map((item) => {
        const hintText = item.hints.filter(Boolean).join(" • ");
        return {
          key: item.key,
          value: item.value,
          label: item.label || item.value,
          hint: hintText,
          searchText: normalizeName(`${item.value} ${item.label} ${hintText}`),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "vi", { sensitivity: "base" }));
  }, [options]);

  const searchValue = normalizeStr(search);
  const searchKey = normalizeName(searchValue);
  const filteredOptions = useMemo(() => {
    if (!searchKey) {
      return normalizedOptions;
    }
    return normalizedOptions.filter((item) => item.searchText.includes(searchKey));
  }, [normalizedOptions, searchKey]);
  const hasExactOption = normalizedOptions.some((item) => item.key === searchKey);
  const canCreateCustom = Boolean(searchKey) && !hasExactOption;

  const handleSelect = (nextValue) => {
    const safeValue =
      nextValue === undefined || nextValue === null ? "" : normalizeStr(nextValue);
    onSelect?.(safeValue);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={joinClasses(
            fullWidth ? "w-full" : "w-40",
            "justify-between px-2 py-0 text-left font-normal",
          )}
        >
          <span className="truncate">{normalizedValue || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Tìm đại lý"
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>Không có đại lý phù hợp.</CommandEmpty>
            {normalizedValue ? (
              <CommandGroup heading="Tùy chọn">
                <CommandItem value="__clear__" onSelect={() => handleSelect("")}>
                  <CircleX className="mr-2 size-4" />
                  Bỏ chọn đại lý
                </CommandItem>
              </CommandGroup>
            ) : null}
            {canCreateCustom ? (
              <CommandGroup heading="Thêm mới">
                <CommandItem value={searchValue} onSelect={() => handleSelect(searchValue)}>
                  <Plus className="mr-2 size-4" />
                  Dùng giá trị "{searchValue}"
                </CommandItem>
              </CommandGroup>
            ) : null}
            {filteredOptions.length ? (
              <CommandGroup heading="Đại lý">
                {filteredOptions.map((option) => {
                  const isSelected = option.key === normalizedKey;
                  return (
                    <CommandItem
                      key={option.key}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                    >
                      <Check
                        className={joinClasses(
                          "mr-2 size-4",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="truncate">{option.label}</span>
                        {option.hint ? (
                          <span className="text-xs text-muted-foreground">{option.hint}</span>
                        ) : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
