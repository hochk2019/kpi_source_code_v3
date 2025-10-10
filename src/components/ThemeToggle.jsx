import React from 'react';
import { Contrast, MonitorSmartphone, MoonStar, Palette, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { useTheme } from '@/designSystem/useTheme.js';

const OPTIONS = [
  {
    value: 'system',
    label: 'Theo hệ thống',
    description: 'Tự điều chỉnh theo thiết lập của Windows/macOS',
    icon: MonitorSmartphone,
  },
  {
    value: 'light',
    label: 'Giao diện sáng',
    description: 'Nền sáng, phù hợp văn phòng, dễ in ấn',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Giao diện tối',
    description: 'Giảm chói mắt khi làm việc ban đêm',
    icon: MoonStar,
  },
  {
    value: 'high-contrast',
    label: 'Tương phản cao',
    description: 'Độ tương phản đậm, hỗ trợ người suy giảm thị lực',
    icon: Contrast,
  },
];

export default function ThemeToggle({ className = '' }) {
  const { theme, resolvedTheme, setTheme, brand, setBrand, brandOptions } = useTheme();
  const active = theme === 'system' ? resolvedTheme : theme;
  const ActiveIcon =
    active === 'dark'
      ? MoonStar
      : active === 'light'
        ? Sun
        : active === 'high-contrast'
          ? Contrast
          : MonitorSmartphone;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex items-center gap-2 rounded-full border border-transparent bg-white/70 px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-accent-ring)] dark:bg-slate-800/70 dark:text-gray-200 ${className}`.trim()}
        aria-label="Thay đổi theme giao diện"
      >
        <ActiveIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{active === 'dark' ? 'Giao diện tối' : active === 'light' ? 'Giao diện sáng' : 'Theo hệ thống'}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Chọn phong cách hiển thị</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = theme === option.value || (theme === 'system' && option.value === resolvedTheme);
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className={`flex items-start gap-3 text-sm ${selected ? 'text-[var(--ds-accent-strong)]' : ''}`}
            >
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-xs text-gray-500">{option.description}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Bảng màu thương hiệu
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {brandOptions.map((option) => {
          const selected = brand === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setBrand(option.value)}
              className={`flex items-start gap-3 text-sm ${selected ? 'text-[var(--ds-accent-strong)]' : ''}`}
            >
              <span
                className="mt-0.5 h-5 w-5 flex-shrink-0 overflow-hidden rounded-full border border-black/10"
                style={{ background: option.gradient ?? option.preview }}
                aria-hidden="true"
              />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-xs text-gray-500">{option.description}</span>
              </span>
              {selected && (
                <span className="ml-auto mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold uppercase text-brand-700">
                  Đang dùng
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
