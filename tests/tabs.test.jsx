import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';

describe('tabs primitives', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps default trigger styling when unstyled is not requested', () => {
    render(
      <Tabs value="overview">
        <TabsList aria-label="Default tabs">
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Panel</TabsContent>
      </Tabs>,
    );

    const trigger = screen.getByRole('tab', { name: 'Overview' });

    expect(trigger.className).toContain('inline-flex');
    expect(trigger.className).toContain('px-2');
    expect(trigger.className).toContain('py-1');
  });

  it('allows shell consumers to opt out of default trigger and list classes', () => {
    render(
      <Tabs value="overview">
        <TabsList unstyled aria-label="Shell tabs" className="custom-list">
          <TabsTrigger unstyled value="overview" className="custom-trigger">
            Overview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Panel</TabsContent>
      </Tabs>,
    );

    const list = screen.getByRole('tablist', { name: 'Shell tabs' });
    const trigger = within(list).getByRole('tab', { name: 'Overview' });

    expect(list.className).toBe('custom-list');
    expect(trigger.className).toBe('custom-trigger');
    expect(trigger.className).not.toContain('px-2');
    expect(trigger.className).not.toContain('py-1');
    expect(trigger.className).not.toContain('inline-flex');
  });
});
