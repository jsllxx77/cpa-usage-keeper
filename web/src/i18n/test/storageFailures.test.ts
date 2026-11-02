// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.doMock('i18next', async () => {
    const { default: i18n } = await vi.importActual<typeof import('i18next')>('i18next');
    return { default: i18n.createInstance() };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock('i18next');
  localStorage.clear();
});

describe('language preference storage failures', () => {
  it.each(['getter', 'getItem'] as const)('initializes in English when the storage %s throws SecurityError', async (failure) => {
    const fail = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
    const getItem = vi.fn(fail);
    if (failure === 'getter') vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(fail);
    else vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });

    const { default: i18n, persistLanguage } = await import('..');
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe('en');
    if (failure === 'getItem') expect(getItem).toHaveBeenCalledWith('cpa-usage-keeper-language');
    await i18n.changeLanguage('zh');
    expect(() => persistLanguage('zh')).not.toThrow();
    expect(i18n.language).toBe('zh');
  });

  it.each(['SecurityError', 'QuotaExceededError'])('keeps the restored and changed language when setItem throws %s', async (name) => {
    localStorage.setItem('cpa-usage-keeper-language', 'zh-TW');
    const { default: i18n, persistLanguage } = await import('..');
    expect(i18n.language).toBe('zh-TW');
    const storage = localStorage;
    const setItem = vi.fn(() => { throw new DOMException('Storage write denied', name); });
    vi.stubGlobal('localStorage', { getItem: storage.getItem.bind(storage), setItem });
    await i18n.changeLanguage('zh');
    expect(() => persistLanguage('zh')).not.toThrow();
    expect(i18n.language).toBe('zh');
    expect(setItem).toHaveBeenCalledWith('cpa-usage-keeper-language', 'zh');
    expect(localStorage.getItem('cpa-usage-keeper-language')).toBe('zh-TW');
  });
});