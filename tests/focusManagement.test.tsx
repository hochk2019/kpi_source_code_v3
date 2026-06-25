import { afterEach, describe, expect, it } from 'vitest';

import {
  FOCUSABLE_SELECTOR,
  getFocusBoundary,
  getFocusableElements,
  getRovingTabIndex,
  isFocusable,
} from '@/lib/focusManagement';

function mount(html: string): HTMLDivElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('FOCUSABLE_SELECTOR', () => {
  it('includes the common interactive element selectors', () => {
    expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
    expect(FOCUSABLE_SELECTOR).toContain('a[href]');
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });
});

describe('getFocusableElements', () => {
  it('returns an empty array for null/undefined container', () => {
    expect(getFocusableElements(null)).toEqual([]);
    expect(getFocusableElements(undefined)).toEqual([]);
  });

  it('collects focusable descendants in DOM order', () => {
    const root = mount(`
      <a href="#one">one</a>
      <button>two</button>
      <input />
      <select><option>x</option></select>
      <textarea></textarea>
      <div tabindex="0">custom</div>
    `);

    const focusable = getFocusableElements(root);
    expect(focusable.map((el) => el.tagName.toLowerCase())).toEqual([
      'a',
      'button',
      'input',
      'select',
      'textarea',
      'div',
    ]);
  });

  it('excludes disabled controls and negative tabindex elements', () => {
    const root = mount(`
      <button disabled>disabled</button>
      <input disabled />
      <div tabindex="-1">skip</div>
      <button>keep</button>
    `);

    const focusable = getFocusableElements(root);
    expect(focusable).toHaveLength(1);
    expect(focusable[0].textContent).toBe('keep');
  });

  it('excludes elements hidden via the hidden attribute', () => {
    const root = mount(`
      <button hidden>hidden</button>
      <button>visible</button>
    `);

    const focusable = getFocusableElements(root);
    expect(focusable).toHaveLength(1);
    expect(focusable[0].textContent).toBe('visible');
  });
});

describe('isFocusable', () => {
  it('returns false for non-elements', () => {
    expect(isFocusable(null)).toBe(false);
  });

  it('returns false for aria-hidden elements', () => {
    const root = mount('<button aria-hidden="true">x</button>');
    expect(isFocusable(root.querySelector('button'))).toBe(false);
  });

  it('returns true for an enabled button', () => {
    const root = mount('<button>x</button>');
    expect(isFocusable(root.querySelector('button'))).toBe(true);
  });
});

describe('getFocusBoundary', () => {
  it('returns null boundaries when no focusable children exist', () => {
    const root = mount('<p>just text</p>');
    expect(getFocusBoundary(root)).toEqual({ first: null, last: null });
  });

  it('returns the first and last focusable elements', () => {
    const root = mount(`
      <button>first</button>
      <input />
      <button>last</button>
    `);

    const { first, last } = getFocusBoundary(root);
    expect(first?.textContent).toBe('first');
    expect(last?.textContent).toBe('last');
  });
});

describe('getRovingTabIndex', () => {
  it('returns -1 for empty collections', () => {
    expect(getRovingTabIndex(0, 0, 1)).toBe(-1);
  });

  it('moves forward and wraps around the end', () => {
    expect(getRovingTabIndex(0, 3, 1)).toBe(1);
    expect(getRovingTabIndex(2, 3, 1)).toBe(0);
  });

  it('moves backward and wraps around the start', () => {
    expect(getRovingTabIndex(0, 3, -1)).toBe(2);
    expect(getRovingTabIndex(1, 3, -1)).toBe(0);
  });

  it('normalizes out-of-range and non-finite indices', () => {
    expect(getRovingTabIndex(7, 3, 1)).toBe(2); // 7 % 3 = 1 -> +1 = 2
    expect(getRovingTabIndex(Number.NaN, 3, 1)).toBe(1);
  });
});
