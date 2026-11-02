// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { triggerHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useUsageStatsStore } from '@/stores';
import type { StatCardsProps } from '@/components/usage/StatCards';

const api = vi.hoisted(() => ({
  fetchUsageOverview: vi.fn(),
  fetchUsageOverviewRealtime: vi.fn(),
}));

vi.mock('react-chartjs-2', () => ({ Bar: () => null, Chart: () => null, Doughnut: () => null, Line: () => null, Scatter: () => null }));
// Keep real page/filter/request state; chart and metric presentation have separate tests.
vi.mock('@/components/usage/StatCards', () => ({
  StatCards: ({ usage, loading, dailyAverageUsage }: StatCardsProps) => <div
    data-overview-metrics
    data-requests={usage?.usage.total_requests ?? 'missing'}
    data-cost={usage?.summary?.total_cost ?? 'missing'}
    data-daily-requests={dailyAverageUsage?.usage.total_requests ?? 'missing'}
    data-loading={String(loading)}
  />,
}));
vi.mock('@/components/usage/OverviewRealtimePanel', () => ({ OverviewRealtimePanel: () => null }));
vi.mock('@/lib/api', async (original) => ({
  ...await original<typeof import('@/lib/api')>(),
  ...api,
  fetchStatus: async () => ({ timezone: 'UTC' }),
  fetchVersion: async () => ({ version: 'test' }),
  fetchCpaApiKeyOptions: async () => ({ options: [{ id: '11', label: 'Key A' }, { id: '22', label: 'Key B' }] }),
  fetchUsageActivity: () => new Promise(() => undefined),
  fetchUsageOverviewComparisons: () => new Promise(() => undefined),
}));

import { UsagePage } from '../UsagePage';

const overview = (count: number) => ({
  usage: { total_requests: count, success_count: count, failure_count: 0, total_tokens: count * 10 },
  summary: { total_cost: count, cost_available: true },
  timezone: 'UTC',
});

describe('UsagePage overview query state and slow refresh', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    await i18n.changeLanguage('en');
    localStorage.clear();
    localStorage.setItem('cli-proxy-usage-api-key-filter-v1', '11');
    localStorage.setItem('cli-proxy-usage-time-range-v1', '7d');
    window.history.replaceState(null, '', '/overview');
    useUsageStatsStore.getState().clearUsageStats();
    api.fetchUsageOverview.mockReset().mockResolvedValue(overview(101));
    api.fetchUsageOverviewRealtime.mockReset().mockReturnValue(new Promise(() => undefined));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    useUsageStatsStore.getState().clearUsageStats();
    container.remove();
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async () => { await act(async () => root.render(<UsagePage />)); };
  const metrics = () => container.querySelector<HTMLElement>('[data-overview-metrics]')!;
  const chooseKeyB = async () => {
    await act(async () => container.querySelector<HTMLButtonElement>('[data-dashboard-toolbar] button[aria-label^="API Key: "]')!.click());
    const option = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(node => node.textContent === 'Key B')!;
    await act(async () => option.click());
  };

  it('removes another key\'s totals and daily averages while loading and after failure', async () => {
    await render();
    expect(metrics().dataset.requests).toBe('101');
    expect(metrics().dataset.dailyRequests).toBe('101');
    const pending = Promise.withResolvers<ReturnType<typeof overview>>();
    api.fetchUsageOverview.mockReturnValueOnce(pending.promise);
    await chooseKeyB();
    expect(api.fetchUsageOverview.mock.lastCall![2]).toBe('22');
    expect(metrics().dataset.requests).toBe('missing');
    expect(metrics().dataset.cost).toBe('missing');
    expect(metrics().dataset.dailyRequests).toBe('missing');
    expect(metrics().dataset.loading).toBe('true');

    await act(async () => { pending.reject(new Error('Key B failed')); });
    expect(container.textContent).toContain('Key B failed');
    expect(metrics().dataset.requests).toBe('missing');
    expect(metrics().dataset.dailyRequests).toBe('missing');

    api.fetchUsageOverview.mockResolvedValueOnce(overview(202));
    await act(async () => { void triggerHeaderRefresh().catch(() => {}); });
    expect(metrics().dataset.requests).toBe('202');
    expect(metrics().dataset.cost).toBe('202');
  });

  it('removes the previous range totals and daily averages when the range changes', async () => {
    await render();
    api.fetchUsageOverview.mockReturnValueOnce(new Promise(() => undefined));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-time-range-trigger="desktop"]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[data-time-range-mode="yesterday"]')!.click());
    expect(api.fetchUsageOverview.mock.lastCall![0]).toMatchObject({ range: 'yesterday' });
    expect(metrics().dataset.requests).toBe('missing');
    expect(metrics().dataset.cost).toBe('missing');
    expect(metrics().dataset.dailyRequests).toBe('missing');
    expect(metrics().dataset.loading).toBe('true');
  });

  it('retains the committed result during a same-query refresh and after its failure', async () => {
    await render();
    const pending = Promise.withResolvers<ReturnType<typeof overview>>();
    api.fetchUsageOverview.mockReturnValueOnce(pending.promise);
    await act(async () => { void triggerHeaderRefresh().catch(() => {}); });
    expect(metrics().dataset.requests).toBe('101');
    expect(metrics().dataset.loading).toBe('false');
    await act(async () => { pending.reject(new Error('Refresh failed')); });
    expect(metrics().dataset.requests).toBe('101');
    expect(container.textContent).toContain('Refresh failed');
  });

  it.each(['overview', 'realtime'] as const)('lets a slow initial %s request finish across multiple automatic refresh ticks', async (tab) => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', `/${tab}`);
    const request = tab === 'overview' ? api.fetchUsageOverview : api.fetchUsageOverviewRealtime;
    const pending = Promise.withResolvers<unknown>();
    request.mockReturnValueOnce(pending.promise);
    await render();
    const signal = tab === 'overview' ? request.mock.calls[0][1] as AbortSignal : request.mock.calls[0][0].signal as AbortSignal;
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(request).toHaveBeenCalledTimes(1);
    expect(signal.aborted).toBe(false);
    await act(async () => pending.resolve(tab === 'overview' ? overview(303) : { window: '15m' }));
    expect(tab === 'overview' ? useUsageStatsStore.getState().usage?.usage.total_requests : useUsageStatsStore.getState().realtime?.window)
      .toBe(tab === 'overview' ? 303 : '15m');
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(request).toHaveBeenCalledTimes(2);
  });
});
