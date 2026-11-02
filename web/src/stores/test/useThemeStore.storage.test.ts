// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY_THEME } from '@/utils/constants';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme preference storage failures', () => {
  it.each(['getter', 'getItem'] as const)('initializes and changes the in-memory theme when the storage %s throws SecurityError', async (failure) => {
    const fail = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
    const getItem = vi.fn(fail);
    if (failure === 'getter') vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(fail);
    else vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });

    const { useThemeStore } = await import('../useThemeStore');
    expect(useThemeStore.getState().theme).toBe('auto');
    if (failure === 'getItem') expect(getItem).toHaveBeenCalledWith(STORAGE_KEY_THEME);
    let cleanup: (() => void) | undefined;
    expect(() => { cleanup = useThemeStore.getState().initializeTheme(); }).not.toThrow();
    expect(() => useThemeStore.getState().setTheme('dark')).not.toThrow();
    expect(useThemeStore.getState()).toMatchObject({ theme: 'dark', resolvedTheme: 'dark' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    cleanup?.();
  });

  it.each(['SecurityError', 'QuotaExceededError'])('applies saved and changed themes when setItem throws %s during initialization', async (name) => {
    localStorage.setItem(STORAGE_KEY_THEME, JSON.stringify({ version: 0, state: { theme: 'dark', resolvedTheme: 'dark' } }));
    const storage = localStorage;
    const setItem = vi.fn(() => { throw new DOMException('Storage write denied', name); });
    vi.stubGlobal('localStorage', { getItem: storage.getItem.bind(storage), setItem });
    const { useThemeStore } = await import('../useThemeStore');
    expect(useThemeStore.getState().theme).toBe('dark');
    let cleanup: (() => void) | undefined;
    expect(() => { cleanup = useThemeStore.getState().initializeTheme(); }).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(() => useThemeStore.getState().setTheme('white')).not.toThrow();
    expect(useThemeStore.getState()).toMatchObject({ theme: 'white', resolvedTheme: 'light' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('white');
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY_THEME, expect.any(String));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_THEME)!)).toMatchObject({ state: { theme: 'dark' } });
    cleanup?.();
  });
});