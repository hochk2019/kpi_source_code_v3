import React from 'react';
import { Contrast, MonitorSmartphone, MoonStar, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { useTheme } from '@/designSystem/ThemeProvider.jsx';

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
  const { theme, resolvedTheme, setTheme } = useTheme();
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
