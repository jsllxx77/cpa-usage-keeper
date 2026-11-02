// @vitest-environment happy-dom
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, logout as requestLogout } from '@/lib/api';
import { useLogout } from '../useLogout';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api')>(),
  logout: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('useLogout', () => {
  let container: HTMLDivElement;
  let root: Root;
  let controller: ReturnType<typeof useLogout>;
  const onAuthRequired = vi.fn();

  function Harness({ notify = onAuthRequired }: { notify?: () => void }) {
    const value = useLogout({ onAuthRequired: notify });
    useLayoutEffect(() => { controller = value; });
    return <button onClick={() => void value.logout()}>Sign out</button>;
  }

  beforeEach(async () => {
    onAuthRequired.mockReset();
    vi.mocked(requestLogout).mockReset().mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('notifies authentication only after logout succeeds', async () => {
    expect(controller.error).toBeNull();
    expect(controller.loggingOut).toBe(false);
    await act(async () => {
      await expect(controller.logout()).resolves.toBe(true);
    });
    expect(requestLogout).toHaveBeenCalledOnce();
    expect(onAuthRequired).toHaveBeenCalledOnce();
    expect(controller.error).toBeNull();
    expect(controller.loggingOut).toBe(false);
  });

  it('treats ApiError 401 as an already invalid session', async () => {
    vi.mocked(requestLogout).mockRejectedValue(new ApiError('expired', 401));
    await act(async () => {
      await expect(controller.logout()).resolves.toBe(true);
    });
    expect(onAuthRequired).toHaveBeenCalledOnce();
    expect(controller.error).toBeNull();
    expect(controller.loggingOut).toBe(false);
  });

  it.each([
    ['server failure', new ApiError('raw server detail', 500)],
    ['network failure', new TypeError('Failed to fetch')],
    ['non-API status lookalike', { status: 401 }],
    ['unknown rejection', undefined],
  ])('resolves false and retains authentication on %s', async (_, error) => {
    vi.mocked(requestLogout).mockRejectedValue(error);
    await act(async () => {
      await expect(controller.logout()).resolves.toBe(false);
    });
    expect(onAuthRequired).not.toHaveBeenCalled();
    expect(controller.error).toBe('auth.logout_failed');
    expect(controller.loggingOut).toBe(false);
  });

  it('allows a successful retry after a failure and clears the previous error', async () => {
    vi.mocked(requestLogout).mockRejectedValueOnce(new TypeError('offline'));
    await act(async () => { await controller.logout(); });
    expect(controller.error).toBe('auth.logout_failed');
    await act(async () => {
      await expect(controller.logout()).resolves.toBe(true);
    });
    expect(requestLogout).toHaveBeenCalledTimes(2);
    expect(onAuthRequired).toHaveBeenCalledOnce();
    expect(controller.error).toBeNull();
  });

  it('blocks same-turn submissions and keeps pending true until the request settles', async () => {
    let resolveRequest!: () => void;
    vi.mocked(requestLogout).mockReturnValueOnce(new Promise<void>((resolve) => { resolveRequest = resolve; }));
    let first!: Promise<boolean>;
    await act(async () => {
      first = controller.logout();
      await expect(controller.logout()).resolves.toBe(false);
    });
    expect(requestLogout).toHaveBeenCalledOnce();
    expect(controller.loggingOut).toBe(true);
    expect(onAuthRequired).not.toHaveBeenCalled();
    await act(async () => {
      await expect(controller.logout()).resolves.toBe(false);
      resolveRequest();
      await expect(first).resolves.toBe(true);
    });
    expect(requestLogout).toHaveBeenCalledOnce();
    expect(onAuthRequired).toHaveBeenCalledOnce();
    expect(controller.loggingOut).toBe(false);
  });

  it('supports fire-and-forget event handlers on failure without rejecting', async () => {
    vi.mocked(requestLogout).mockRejectedValueOnce(new TypeError('offline'));
    const unhandled = vi.fn();
    window.addEventListener('unhandledrejection', unhandled);
    try {
      await act(async () => container.querySelector('button')!.click());
      expect(controller.error).toBe('auth.logout_failed');
      expect(onAuthRequired).not.toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('unhandledrejection', unhandled);
    }
  });

  it('exposes a stable callback that clears an error without logging out', async () => {
    const clearError = controller.clearError;
    vi.mocked(requestLogout).mockRejectedValueOnce(new ApiError('failed', 500));
    await act(async () => { await controller.logout(); });
    expect(controller.clearError).toBe(clearError);
    await act(async () => controller.clearError());
    expect(controller.error).toBeNull();
    expect(controller.clearError).toBe(clearError);
    expect(requestLogout).toHaveBeenCalledOnce();
    expect(onAuthRequired).not.toHaveBeenCalled();
  });

  it.each(['synchronous', 'asynchronous'])('does not reject after a failing %s auth notification', async (mode) => {
    const notify = mode === 'synchronous'
      ? () => { throw new Error('notification failed'); }
      : async () => { throw new Error('notification failed'); };
    await act(async () => root.render(<Harness notify={notify} />));
    await act(async () => {
      await expect(controller.logout()).resolves.toBe(true);
    });
    expect(controller.loggingOut).toBe(false);
    expect(controller.error).toBeNull();
  });
});
