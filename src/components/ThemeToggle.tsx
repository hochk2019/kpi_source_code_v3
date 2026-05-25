import React from 'react';

import { Contrast, MonitorSmartphone, MoonStar, Palette, Sun } from 'lucide-react';

import {

  DropdownMenu,

  DropdownMenuContent,

  DropdownMenuItem,

  DropdownMenuLabel,

  DropdownMenuSeparator,

  DropdownMenuTrigger,

} from '@/components/ui/dropdown-menu';

import { useTheme } from '@/designSystem/useTheme.js';
import { t } from '@/lib/i18n.js';
import type { ThemeMode } from '@/types/index.js';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ThemeToggleProps {
  className?: string;
}

interface ThemeOption {
  value: ThemeMode | 'system';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {

  const { theme, resolvedTheme, setTheme, brand, setBrand, brandOptions } = useTheme();

  const OPTIONS: ThemeOption[] = [
    { value: 'system', label: t('theme.system'), description: t('theme.systemDesc'), icon: MonitorSmartphone },
    { value: 'light', label: t('theme.light'), description: t('theme.lightDesc'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), description: t('theme.darkDesc'), icon: MoonStar },
    { value: 'high-contrast', label: t('theme.highContrast'), description: t('theme.highContrastDesc'), icon: Contrast },
  ];

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

        aria-label={t('theme.ariaLabel')}

      >

        <ActiveIcon className="h-4 w-4" />

        <span className="hidden sm:inline">{active === 'dark' ? t('theme.dark') : active === 'light' ? t('theme.light') : t('theme.system')}</span>

      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">

        <DropdownMenuLabel>{t('theme.chooseStyle')}</DropdownMenuLabel>

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

          {t('theme.brandPalette')}

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

                  {t('theme.active')}

                </span>

              )}

            </DropdownMenuItem>

          );

        })}

      </DropdownMenuContent>

    </DropdownMenu>

  );

}

