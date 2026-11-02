// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, logout as requestLogout } from '@/lib/api';
import { KeyViewerShell } from '../KeyViewerShell';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api')>(),
  logout: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', changeLanguage: vi.fn() } }),
}));
vi.mock('@/i18n', () => ({ isSupportedLanguage: () => true, persistLanguage: vi.fn() }));
vi.mock('@/stores', () => ({
  useThemeStore: (select: (state: object) => unknown) => select({ theme: 'white', setTheme: vi.fn() }),
}));
vi.mock('@/components/dashboard/DashboardToolbar', () => ({ DashboardToolbar: () => <div data-viewer-toolbar /> }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('KeyViewerShell logout', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onAuthRequired = vi.fn();

  beforeEach(async () => {
    onAuthRequired.mockReset();
    vi.mocked(requestLogout).mockReset().mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(
      <KeyViewerShell activePage="overview" onRefresh={vi.fn()} onNavigate={vi.fn()} onAuthRequired={onAuthRequired}>
        <p data-viewer-content>Authenticated viewer content</p>
      </KeyViewerShell>,
    ));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function openLogoutMenu() {
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!.click());
    return container.querySelector<HTMLButtonElement>('[role="menuitem"]')!;
  }

  it.each([
    ['server failure', new ApiError('private server details', 500)],
    ['network failure', new TypeError('Failed to fetch')],
  ])('preserves the viewer and offers a localized retry after %s', async (_, error) => {
    const content = container.querySelector('[data-viewer-content]');
    vi.mocked(requestLogout).mockRejectedValueOnce(error);
    const unhandled = vi.fn();
    window.addEventListener('unhandledrejection', unhandled);
    try {
      const logout = await openLogoutMenu();
      await act(async () => logout.click());
      expect(onAuthRequired).not.toHaveBeenCalled();
      expect(container.querySelector('[data-viewer-content]')).toBe(content);
      const alert = container.querySelector('[role="alert"]')!;
      expect(alert.textContent).toContain('auth.logout_failed');
      expect(alert.textContent).not.toContain(error.message);
      const retry = alert.querySelector<HTMLButtonElement>('button')!;
      expect(retry.textContent).toBe('common.retry');
      expect(retry.disabled).toBe(false);
      expect(unhandled).not.toHaveBeenCalled();

      await act(async () => retry.click());
      expect(requestLogout).toHaveBeenCalledTimes(2);
      expect(onAuthRequired).toHaveBeenCalledOnce();
      expect(container.querySelector('[role="alert"]')).toBeNull();
    } finally {
      window.removeEventListener('unhandledrejection', unhandled);
    }
  });

  it('notifies authentication after a successful logout', async () => {
    const logout = await openLogoutMenu();
    await act(async () => logout.click());
    expect(requestLogout).toHaveBeenCalledOnce();
    expect(onAuthRequired).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('notifies authentication for a session that is already invalid', async () => {
    vi.mocked(requestLogout).mockRejectedValueOnce(new ApiError('expired', 401));
    const logout = await openLogoutMenu();
    await act(async () => logout.click());
    expect(onAuthRequired).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('disables repeat logout submissions while the first request is pending', async () => {
    let rejectRequest!: (error: Error) => void;
    vi.mocked(requestLogout).mockReturnValueOnce(new Promise<void>((_, reject) => { rejectRequest = reject; }));
    const logout = await openLogoutMenu();
    await act(async () => logout.click());
    expect(onAuthRequired).not.toHaveBeenCalled();
    const pendingLogout = await openLogoutMenu();
    expect(pendingLogout.disabled).toBe(true);
    expect(pendingLogout.getAttribute('aria-busy')).toBe('true');
    await act(async () => { pendingLogout.click(); pendingLogout.click(); });
    expect(requestLogout).toHaveBeenCalledOnce();

    await act(async () => rejectRequest(new ApiError('server error', 500)));
    expect(onAuthRequired).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('auth.logout_failed');
    expect(container.querySelector<HTMLButtonElement>('[role="menuitem"]')!.disabled).toBe(false);
  });
});
