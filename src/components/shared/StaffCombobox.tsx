import React, { useEffect, useMemo, useState } from "react";

import { normalizeName, normalizeStr } from "@/lib/storeCoreHelpers.js";
import { buildStaffComboboxTeams } from "@/components/shared/staffComboboxOptions.js";
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

interface TeamMember {
  id: string;
  name: string;
  normalized: string;
}

interface NormalizedTeam {
  id: string;
  name: string;
  normalized: string;
  members: TeamMember[];
}

interface StaffSelection {
  staffName: string;
  teamName: string;
  isCustom?: boolean;
}

interface MemberSelection {
  id: string;
  name: string;
  teamId: string | null;
  teamName: string | null;
  normalizedName: string;
  normalizedTeam: string;
}

interface StaffComboboxProps {
  value?: string;
  teamValue?: string;
  onSelect?: (selection: StaffSelection | MemberSelection | null) => void;
  teams?: Record<string, unknown>[];
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  searchAriaLabel?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  clearGroupLabel?: string;
  clearLabel?: string;
  showClearWhenEmpty?: boolean;
  allowCustom?: boolean;
  preserveTeamOnCustom?: boolean;
  preserveTeamOnClear?: boolean;
  selectionMode?: "assignment" | "member";
  buttonClassName?: string;
  popoverClassName?: string;
  groupHeadingFormatter?: (team: NormalizedTeam) => string;
  dataTestId?: string;
}

export default function StaffCombobox({
  value,
  teamValue,
  onSelect,
  teams,
  disabled = false,
  placeholder = "Chọn nhân viên",
  ariaLabel,
  searchAriaLabel,
  searchPlaceholder = "Tìm nhân viên",
  emptyMessage = "Không có nhân viên phù hợp.",
  clearGroupLabel = "Tùy chọn",
  clearLabel = "Bỏ chọn nhân viên",
  showClearWhenEmpty = false,
  allowCustom,
  preserveTeamOnCustom = false,
  preserveTeamOnClear = false,
  selectionMode = "assignment",
  buttonClassName = "w-full justify-between px-2 py-1 text-left font-normal",
  popoverClassName = "w-64 p-0",
  groupHeadingFormatter,
  dataTestId,
}: StaffComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const normalizedTeams = useMemo(() => buildStaffComboboxTeams(teams), [teams]);
  const normalizedValue = normalizeStr(value || "");
  const normalizedTeamValue = normalizeName(normalizeStr(teamValue || ""));
  const isMemberMode = selectionMode === "member";

  const staffIndex = useMemo(() => {
    return normalizedTeams.flatMap((team: NormalizedTeam) =>
      team.members.map((member: TeamMember) => ({
        id: member.id,
        name: member.name,
        normalized: member.normalized,
        teamId: team.id,
        teamName: team.name,
        teamNormalized: team.normalized,
      })),
    );
  }, [normalizedTeams]);

  const selectedEntry = useMemo(() => {
    if (!normalizedValue) {
      return null;
    }
    const key = normalizeName(normalizedValue);
    return (
      staffIndex.find((entry) => (isMemberMode ? normalizeName(entry.id) : entry.normalized) === key) || null
    );
  }, [isMemberMode, normalizedValue, staffIndex]);

  const orderedTeams = useMemo(() => {
    if (!normalizedTeams.length || !normalizedTeamValue) {
      return normalizedTeams;
    }
    const next = [...normalizedTeams];
    const index = next.findIndex((team) => team.normalized === normalizedTeamValue);
    if (index <= 0) {
      return next;
    }
    const [currentTeam] = next.splice(index, 1);
    return [currentTeam, ...next];
  }, [normalizedTeamValue, normalizedTeams]);

  const searchValue = normalizeStr(search);
  const searchKey = normalizeName(searchValue);
  const customEnabled = allowCustom ?? !isMemberMode;
  const hasExactStaff = useMemo(() => {
    if (!searchKey) {
      return false;
    }
    return staffIndex.some((entry) => entry.normalized === searchKey);
  }, [searchKey, staffIndex]);
  const canCreateCustom = !isMemberMode && customEnabled && Boolean(searchKey) && !hasExactStaff;

  const buttonLabel = useMemo(() => {
    if (isMemberMode) {
      if (!selectedEntry) {
        return placeholder;
      }
      return selectedEntry.teamName ? `${selectedEntry.name} – ${selectedEntry.teamName}` : selectedEntry.name;
    }
    return normalizedValue || placeholder;
  }, [isMemberMode, normalizedValue, placeholder, selectedEntry]);

  const formatGroupHeading =
    groupHeadingFormatter || ((team: NormalizedTeam) => (isMemberMode ? team.name : `Tổ: ${team.name}`));
  const shouldShowClear = isMemberMode ? showClearWhenEmpty || Boolean(selectedEntry) : Boolean(normalizedValue);

  const closePopover = () => {
    setOpen(false);
    setSearch("");
  };

  const emitSelection = (selection: StaffSelection | MemberSelection | null) => {
    onSelect?.(selection);
    closePopover();
  };

  const handleClear = () => {
    if (isMemberMode) {
      emitSelection(null);
      return;
    }
    emitSelection({
      staffName: "",
      teamName: preserveTeamOnClear ? normalizeStr(teamValue || "") : "",
    });
  };

  const handleCustom = () => {
    emitSelection({
      staffName: searchValue,
      teamName: preserveTeamOnCustom && normalizedTeamValue ? normalizeStr(teamValue || "") : "",
      isCustom: true,
    });
  };

  const handleMemberSelect = (entry: { id: string; name: string; normalized: string; teamId: string; teamName: string; teamNormalized: string }) => {
    if (!entry) return;
    if (isMemberMode) {
      emitSelection({
        id: entry.id,
        name: entry.name,
        teamId: entry.teamId || null,
        teamName: entry.teamName || null,
        normalizedName: entry.normalized,
        normalizedTeam: entry.teamNormalized,
      });
      return;
    }
    emitSelection({
      staffName: entry.name,
      teamName: entry.teamName,
    });
  };

  const selectedKey = isMemberMode
    ? normalizeName(selectedEntry?.id || normalizedValue)
    : normalizeName(normalizedValue);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel || buttonLabel}
          disabled={disabled}
          className={buttonClassName}
          data-testid={dataTestId}
        >
          <span className="truncate">{buttonLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={popoverClassName} align="start" side="bottom">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            aria-label={searchAriaLabel}
            autoFocus
          />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {shouldShowClear ? (
              <CommandGroup heading={clearGroupLabel}>
                <CommandItem
                  value="__clear__"
                  onSelect={handleClear}
                  className="flex items-center gap-2"
                >
                  <CircleX className="h-4 w-4" />
                  <span className="flex-1">{clearLabel}</span>
                  {isMemberMode && !selectedEntry ? <Check className="h-4 w-4" /> : null}
                </CommandItem>
              </CommandGroup>
            ) : null}
            {canCreateCustom ? (
              <CommandGroup heading="Thêm mới">
                <CommandItem value={searchValue} onSelect={handleCustom}>
                  <Plus className="mr-2 h-4 w-4" />
                  Dùng giá trị "{searchValue}"
                </CommandItem>
              </CommandGroup>
            ) : null}
            {orderedTeams.map((team) => (
              <CommandGroup key={team.id} heading={formatGroupHeading(team)}>
                {team.members.map((member) => {
                  const isSelected = (isMemberMode ? normalizeName(member.id) : member.normalized) === selectedKey;
                  return (
                    <CommandItem
                      key={member.id}
                      value={`${member.name} ${team.name} ${member.id}`}
                      onSelect={() =>
                        handleMemberSelect({
                          id: member.id,
                          name: member.name,
                          normalized: member.normalized,
                          teamId: team.id,
                          teamName: team.name,
                          teamNormalized: team.normalized,
                        })
                      }
                      className="flex items-center gap-2"
                    >
                      <Check className={`h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                      <span className="flex-1 truncate">{member.name}</span>
                      <span className="text-xs text-ds-text-muted">{team.name}</span>
                    </CommandItem>
                  );
                })}
                {team.members.length === 0 && !isMemberMode ? (
                  <div className="px-3 py-2 text-xs text-ds-text-muted">
                    Chưa có nhân viên trong tổ này.
                  </div>
                ) : null}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
