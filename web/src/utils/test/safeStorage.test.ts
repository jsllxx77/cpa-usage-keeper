import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSafeLocalStorage, safeStorageGetItem, safeStorageRemoveItem, safeStorageSetItem } from '../safeStorage';

afterEach(() => { vi.unstubAllGlobals(); });

describe('safeStorage', () => {
  it('handles environments without browser storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getSafeLocalStorage()).toBeUndefined();
    expect(safeStorageGetItem('key')).toBeNull();
    expect(safeStorageSetItem('key', 'value')).toBe(false);
    expect(safeStorageRemoveItem('key')).toBe(false);
  });

  it('catches SecurityError while resolving the localStorage getter', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('Storage blocked', 'SecurityError'); },
    });
    try {
      expect(getSafeLocalStorage()).toBeUndefined();
      expect(safeStorageGetItem('key')).toBeNull();
      expect(safeStorageSetItem('key', 'value')).toBe(false);
      expect(safeStorageRemoveItem('key')).toBe(false);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it.each(['SecurityError', 'QuotaExceededError'])('catches %s from storage methods', (name) => {
    const fail = () => { throw new DOMException('Storage unavailable', name); };
    const storage = { getItem: fail, setItem: fail, removeItem: fail };
    expect(safeStorageGetItem('key', storage)).toBeNull();
    expect(safeStorageSetItem('key', 'value', storage)).toBe(false);
    expect(safeStorageRemoveItem('key', storage)).toBe(false);
  });

  it('uses the supplied storage and preserves method receivers', () => {
    const values = new Map<string, string>();
    const storage = {
      values,
      getItem(key: string) { return this.values.get(key) ?? null; },
      setItem(key: string, value: string) { this.values.set(key, value); },
      removeItem(key: string) { this.values.delete(key); },
    };
    expect(safeStorageSetItem('key', 'value', storage)).toBe(true);
    expect(safeStorageGetItem('key', storage)).toBe('value');
    expect(safeStorageRemoveItem('key', storage)).toBe(true);
    expect(safeStorageGetItem('key', storage)).toBeNull();
  });

  it('resolves default storage on every operation instead of caching failures', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(safeStorageGetItem('key')).toBeNull();
    const storage = { getItem: vi.fn(() => 'saved'), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    expect(getSafeLocalStorage()).toBe(storage);
    expect(safeStorageGetItem('key')).toBe('saved');
    expect(safeStorageSetItem('key', 'next')).toBe(true);
    expect(safeStorageRemoveItem('key')).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith('key', 'next');
    expect(storage.removeItem).toHaveBeenCalledWith('key');
  });

  it('treats an explicit null storage as unavailable', () => {
    expect(safeStorageGetItem('key', null)).toBeNull();
    expect(safeStorageSetItem('key', 'value', null)).toBe(false);
    expect(safeStorageRemoveItem('key', null)).toBe(false);
  });
});