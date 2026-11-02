/** 浏览器策略可能连 localStorage 属性的读取都禁止，必须在 try 内解析。 */
export function getSafeLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** 存储只负责尽力持久化；失败时由调用方继续使用默认值或当前内存状态。 */
export function safeStorageGetItem(
  key: string,
  storage: Pick<Storage, 'getItem'> | null | undefined = getSafeLocalStorage(),
): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeStorageSetItem(
  key: string,
  value: string,
  storage: Pick<Storage, 'setItem'> | null | undefined = getSafeLocalStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeStorageRemoveItem(
  key: string,
  storage: Pick<Storage, 'removeItem'> | null | undefined = getSafeLocalStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
