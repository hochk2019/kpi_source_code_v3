import React from "react";
import { beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { clearStorageCache } from "@/lib/storageClient.js";

const DEFAULT_RECHARTS_WIDTH = 960;
const DEFAULT_RECHARTS_HEIGHT = 320;

function normalizeRechartsSize(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed && !trimmed.endsWith("%")) {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return fallback;
}

if (typeof window !== 'undefined') {
  if (typeof window.HTMLElement.prototype.scrollIntoView === 'undefined') {
    window.HTMLElement.prototype.scrollIntoView = function() {};
  }
  const testDiv = document.createElement('div');
  if (typeof testDiv.getBoundingClientRect === 'undefined' || testDiv.getBoundingClientRect().width === 0) {
    window.HTMLElement.prototype.getBoundingClientRect = function() {
      return { width: 100, height: 100, top: 0, left: 0, bottom: 100, right: 100, x: 0, y: 0 };
    };
  }
}

vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");

  function ResponsiveContainer({
    children,
    width,
    height,
    minWidth,
    minHeight,
    aspect,
    maxHeight,
    debounce,
    onResize,
    className,
    style,
    ...props
  }) {
    void aspect;
    void maxHeight;
    void debounce;
    void onResize;

    const resolvedWidth = Math.max(
      normalizeRechartsSize(minWidth, 0),
      normalizeRechartsSize(width, DEFAULT_RECHARTS_WIDTH),
    );
    const resolvedHeight = Math.max(
      normalizeRechartsSize(minHeight, 0),
      normalizeRechartsSize(height, DEFAULT_RECHARTS_HEIGHT),
    );

    const child = React.Children.only(children);
    const nextChild = React.isValidElement(child)
      ? React.cloneElement(child, {
          width: child.props?.width ?? resolvedWidth,
          height: child.props?.height ?? resolvedHeight,
        })
      : child;

    return React.createElement(
      "div",
      {
        ...props,
        className,
        style: {
          width: resolvedWidth,
          height: resolvedHeight,
          ...style,
        },
        "data-recharts-responsive-container": "mock",
      },
      nextChild,
    );
  }

  return {
    ...actual,
    ResponsiveContainer,
  };
});

// Mock dialog.tsx to avoid Radix Portal/composeRefs issues in JSDOM while
// preserving the accessible dialog contract used by tests.
vi.mock("@/components/ui/dialog.tsx", () => {
  const titleId = "mock-dialog-title";
  const DialogContext = React.createContext({ onOpenChange: null });

  return {
    Dialog: function MockDialog({ children, open, onOpenChange }) {
      React.useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (event) => {
          if (event.key === "Escape") {
            onOpenChange?.(false);
          }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
      }, [onOpenChange, open]);

      return open
        ? React.createElement(
            DialogContext.Provider,
            { value: { onOpenChange } },
            React.createElement("div", { "data-testid": "mock-dialog" }, children),
          )
        : null;
    },
    DialogTrigger: ({ children, onClick }) => React.createElement("div", { "data-testid": "mock-dialog-trigger", onClick }, children),
    DialogContent: ({ children, ...props }) =>
      React.createElement(
        "div",
        {
          ...props,
          "aria-labelledby": props["aria-labelledby"] || titleId,
          "aria-modal": "true",
          "data-testid": "mock-dialog-content",
          role: "dialog",
        },
        children,
      ),
    DialogHeader: ({ children }) => React.createElement("div", null, children),
    DialogTitle: ({ children }) => React.createElement("div", { id: titleId }, children),
    DialogDescription: ({ children }) => React.createElement("div", null, children),
    DialogFooter: ({ children }) => React.createElement("div", null, children),
    DialogClose: ({ children }) => {
      const { onOpenChange } = React.useContext(DialogContext);
      const close = (event) => {
        if (React.isValidElement(children)) {
          children.props?.onClick?.(event);
        }
        onOpenChange?.(false);
      };

      return React.isValidElement(children)
        ? React.cloneElement(children, { onClick: close })
        : React.createElement("button", { type: "button", onClick: close }, children);
    },
    DialogOverlay: () => null,
    DialogPortal: ({ children }) => children,
  };
});

// Mock StaffCombobox to avoid Radix Popover/Slot/composeRefs infinite loop in JSDOM
// Strategy: mock at component boundary, not at Radix primitive level
vi.mock("@/components/shared/StaffCombobox.tsx", () => ({
  default: function MockStaffCombobox({
    value,
    onSelect,
    ariaLabel,
    searchPlaceholder,
    disabled,
    teams,
    selectionMode = "assignment",
    clearLabel = "Bỏ chọn nhân viên",
    showClearWhenEmpty = false,
  }) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    const displayValue = value || "Chọn nhân viên";
    const searchTrimmed = search.trim();
    const normalizeToken = (input) =>
      String(input || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();

    const allMembers = React.useMemo(() => {
      if (!teams || !Array.isArray(teams)) return [];
      const result = [];
      teams.forEach((team) => {
        const members = team.members || team.persons || [];
        members.forEach((m) => {
          const name = m.name || m;
          const normalizedName = m.normalized || normalizeToken(name);
          const teamName = team.name || team;
          result.push({
            id: m.id || name,
            name,
            normalized: normalizedName,
            teamId: team.id || null,
            teamName,
            teamNormalized: team.normalized || normalizeToken(teamName),
          });
        });
      });
      return result;
    }, [teams]);

    const filteredMembers = searchTrimmed
      ? allMembers.filter((m) =>
          m.name.toLowerCase().includes(searchTrimmed.toLowerCase())
        )
      : allMembers;

    const showCustom =
      searchTrimmed &&
      !allMembers.some(
        (m) => m.name.toLowerCase() === searchTrimmed.toLowerCase()
      );

    function handleToggle() {
      if (disabled) return;
      setOpen((v) => !v);
      setSearch("");
    }

    function handleSelectMember(member) {
      if (selectionMode === "member") {
        onSelect && onSelect({
          id: member.id,
          name: member.name,
          teamId: member.teamId,
          teamName: member.teamName || null,
          normalizedName: member.normalized,
          normalizedTeam: member.teamNormalized,
        });
      } else {
        onSelect && onSelect({ staffName: member.name, teamName: member.teamName || "" });
      }
      setOpen(false);
      setSearch("");
    }

    function handleClear() {
      onSelect && onSelect(selectionMode === "member" ? null : { staffName: "", teamName: "" });
      setOpen(false);
      setSearch("");
    }

    function handleCustom() {
      onSelect && onSelect({ staffName: searchTrimmed, teamName: "", isCustom: true });
      setOpen(false);
      setSearch("");
    }

    return React.createElement(
      "div",
      { style: { position: "relative" }, "data-testid": "mock-staff-combobox" },
      React.createElement(
        "button",
        {
          type: "button",
          role: "combobox",
          "aria-label": ariaLabel || displayValue,
          "aria-expanded": open,
          disabled: !!disabled,
          onClick: handleToggle,
        },
        displayValue
      ),
      open
        ? React.createElement(
            "div",
            { "data-testid": "mock-staff-combobox-popover" },
            React.createElement("input", {
              type: "text",
              placeholder: searchPlaceholder || "Tìm nhân viên",
              value: search,
              autoFocus: true,
              onChange: (e) => setSearch(e.target.value),
            }),
            (showClearWhenEmpty || value)
              ? React.createElement(
                  "div",
                  {
                    role: "option",
                    "data-testid": "mock-clear-option",
                    onClick: handleClear,
                  },
                  clearLabel
                )
              : null,
            showCustom
              ? React.createElement(
                  "div",
                  {
                    role: "option",
                    "data-testid": "mock-custom-option",
                    onClick: handleCustom,
                  },
                  `Dùng giá trị "${searchTrimmed}"`
                )
              : null,
            filteredMembers.map((m, i) =>
              React.createElement(
                "div",
                {
                  key: i,
                  role: "option",
                  "aria-label": `${m.name} ${m.teamName || ""}`.trim(),
                  "data-testid": "mock-member-option",
                  onClick: () => handleSelectMember(m),
                },
                m.name,
                m.teamName ? React.createElement("span", null, `Tổ: ${m.teamName}`) : null
              )
            )
          )
        : null
    );
  },
}));

// Mock button.tsx to prevent Slot/composeRefs infinite loop when asChild=true
// Button with asChild uses @radix-ui/react-slot which calls composeRefs → setState loop
vi.mock("@/components/ui/button.tsx", () => ({
  Button: function MockButton({ children, onClick, onPointerDown, disabled, type, className, role, "aria-label": ariaLabel, "aria-expanded": ariaExpanded, ...props }) {
    const passthroughProps = {};
    for (const [key, value] of Object.entries(props)) {
      if (
        key === "id" ||
        key === "name" ||
        key === "title" ||
        key === "value" ||
        key.startsWith("data-") ||
        key.startsWith("aria-")
      ) {
        passthroughProps[key] = value;
      }
    }

    return React.createElement("button", {
      ...passthroughProps,
      onClick,
      onPointerDown,
      disabled,
      type: type || "button",
      className,
      role,
      "aria-label": ariaLabel,
      "aria-expanded": ariaExpanded,
    }, children);
  },
  buttonVariants: () => "",
}));

/*
vi.mock("@/components/kpi-adjustments/panels/KpiAdjustmentDetailDialog.jsx", () => ({
  default: ({ open, entry, onClose }) =>
    open
      ? React.createElement(
          "div",
          { "data-testid": "kpi-adjust-detail-dialog", role: "dialog" },
          React.createElement("div", null, "Chi tiết mục điểm"),
          entry?.staffName ? React.createElement("div", null, entry.staffName) : null,
          entry?.note ? React.createElement("div", null, entry.note) : null,
          React.createElement("button", { type: "button", onClick: onClose }, "Đóng"),
        )
      : null,
}));

vi.mock("@/components/kpi-adjustments/panels/KpiAdjustmentGuidanceDialog.jsx", () => ({
  default: ({ open, onOpenChange }) =>
    open
      ? React.createElement(
          "div",
          { role: "dialog", "aria-label": "Hướng dẫn nhập điểm KPI +/-" },
          React.createElement("button", { type: "button" }, "Hỗ trợ khác"),
          React.createElement("div", null, "Đang áp dụng cấu hình tuỳ chỉnh của đơn vị."),
          React.createElement("div", null, "Tuỳ chỉnh"),
          React.createElement("button", { type: "button", onClick: () => onOpenChange?.(false) }, "Đã rõ"),
        )
      : null,
}));

vi.mock("@/components/kpi-adjustments/panels/KpiAdjustmentSettingsDialog.jsx", () => ({
  default: ({ open, focusCategory, onClose }) =>
    open
      ? React.createElement(
          "div",
          { role: "dialog" },
          focusCategory
            ? React.createElement(
                "div",
                { "data-testid": "kpi-adjust-settings-focus-banner" },
                `Đang chỉnh nhanh cho: ${focusCategory === "support_misc" ? "Hỗ trợ khác" : focusCategory}`,
              )
            : null,
          React.createElement("button", { type: "button", onClick: onClose }, "Đóng"),
        )
      : null,
}));

vi.mock("@/components/ui/tooltip.tsx", () => ({
  TooltipProvider: ({ children }) => React.createElement("div", { "data-testid": "mock-tooltip-provider" }, children),
  Tooltip: ({ children }) => React.createElement("div", { "data-testid": "mock-tooltip" }, children),
  TooltipTrigger: ({ children, asChild, ...props }) =>
    asChild && React.isValidElement(children)
      ? React.cloneElement(children, props)
      : React.createElement("button", { ...props, type: "button" }, children),
  TooltipContent: ({ children, ...props }) => React.createElement("div", { ...props, role: "tooltip" }, children),
}));
*/

// Mock popover.tsx to avoid Radix Portal/composeRefs issues
vi.mock("@/components/ui/popover.tsx", () => {
  const PopoverContext = React.createContext({
    open: false,
    setOpen: () => {},
  });

  return {
    Popover: function MockPopover({ children, open, onOpenChange }) {
      const [internalOpen, setInternalOpen] = React.useState(false);
      const actualOpen = open ?? internalOpen;
      const setOpen = (nextOpen) => {
        setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
      };

      return React.createElement(
        PopoverContext.Provider,
        { value: { open: actualOpen, setOpen } },
        React.createElement("div", { "data-testid": "mock-popover", "data-open": actualOpen }, children),
      );
    },
    PopoverTrigger: function MockPopoverTrigger({ children, asChild, onClick, onPointerDown, ...props }) {
      const { open, setOpen } = React.useContext(PopoverContext);
      const toggle = (event) => {
        onClick?.(event);
        if (React.isValidElement(children)) {
          children.props?.onClick?.(event);
        }
        setOpen(!open);
      };

      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
          ...props,
          "aria-expanded": open,
          onClick: toggle,
          onPointerDown: children.props.onPointerDown || onPointerDown,
        });
      }
      return React.createElement("div", { ...props, "data-testid": "mock-popover-trigger", onClick: toggle, onPointerDown }, children);
    },
    PopoverContent: function MockPopoverContent({ children, ...props }) {
      const { open } = React.useContext(PopoverContext);
      return open ? React.createElement("div", { ...props, "data-testid": "mock-popover-content" }, children) : null;
    },
    PopoverAnchor: function MockPopoverAnchor({ children }) {
      return React.createElement("div", null, children);
    },
  };
});

// Mock command.tsx to avoid cmdk/composeRefs infinite loop
vi.mock("@/components/ui/command.tsx", () => ({
  Command: ({ children }) => React.createElement("div", { "data-testid": "mock-command" }, children),
  CommandInput: function MockCommandInput({ value, onValueChange, placeholder }) {
    return React.createElement("input", {
      "data-testid": "mock-command-input",
      value: value || "",
      placeholder,
      onChange: (e) => onValueChange && onValueChange(e.target.value),
    });
  },
  CommandList: ({ children }) => React.createElement("div", { "data-testid": "mock-command-list" }, children),
  CommandEmpty: ({ children }) => React.createElement("div", { "data-testid": "mock-command-empty" }, children),
  CommandGroup: ({ children, heading: _heading }) => React.createElement("div", { "data-testid": "mock-command-group" }, children),
  CommandItem: function MockCommandItem({ children, onSelect, value, disabled }) {
    const select = () => {
      if (!disabled) {
        onSelect?.(value);
      }
    };

    return React.createElement("div", {
      "data-testid": "mock-command-item",
      "data-value": value,
      "aria-disabled": disabled ? "true" : undefined,
      onClick: select,
      role: "option",
    }, children);
  },
  CommandSeparator: () => React.createElement("hr", null),
  CommandShortcut: ({ children }) => React.createElement("span", null, children),
  CommandDialog: ({ children, open }) => open ? React.createElement("div", { "data-testid": "mock-command-dialog" }, children) : null,
}));

vi.mock("@/hooks/useAppDialog.tsx", () => ({
  useAppDialog: () => ({
    alert: () => Promise.resolve(),
    confirm: () => Promise.resolve(true),
  }),
  AppDialogProvider: ({ children }) => children,
}));

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  clear() {
    this.store.clear();
  }

  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  key(index) {
    return Array.from(this.store.keys())[Number(index)] ?? null;
  }

  get length() {
    return this.store.size;
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new LocalStorageMock(),

  writable: true,

  configurable: true,
});

globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  })
);

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock;
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = IntersectionObserverMock;
}

if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: vi.fn(() => ({
      fillRect: vi.fn(),

      clearRect: vi.fn(),

      getImageData: vi.fn(() => ({ data: [] })),

      putImageData: vi.fn(),

      createImageData: vi.fn(),

      setTransform: vi.fn(),

      drawImage: vi.fn(),

      save: vi.fn(),

      restore: vi.fn(),

      beginPath: vi.fn(),

      moveTo: vi.fn(),

      lineTo: vi.fn(),

      closePath: vi.fn(),

      stroke: vi.fn(),

      translate: vi.fn(),

      scale: vi.fn(),

      rotate: vi.fn(),

      arc: vi.fn(),

      fill: vi.fn(),

      measureText: vi.fn(() => ({ width: 0 })),

      transform: vi.fn(),

      rect: vi.fn(),

      clip: vi.fn(),
    })),

    writable: true,

    configurable: true,
  });
}

beforeEach(() => {
  globalThis.localStorage = new LocalStorageMock();

  globalThis.alert = vi.fn();

  clearStorageCache();
});

afterEach(() => {
  vi.clearAllMocks();
});
