import { useCallback, useMemo } from 'react';
import type { UsageOverviewPayload } from './useUsageData';

export interface SparklineData {
  labels: string[];
  datasets: [
    {
      data: Array<number | null>;
      borderColor: string;
      backgroundColor: string;
      fill: boolean;
      tension: number;
      pointRadius: number;
      borderWidth: number;
    }
  ];
}

export interface SparklineBundle {
  data: SparklineData;
}

export interface UseSparklinesOptions {
  usage: UsageOverviewPayload | null;
  loading: boolean;
}

export interface UseSparklinesReturn {
  requestsSparkline: SparklineBundle | null;
  tokensSparkline: SparklineBundle | null;
  rpmSparkline: SparklineBundle | null;
  tpmSparkline: SparklineBundle | null;
  cacheReadRateSparkline: SparklineBundle | null;
  costSparkline: SparklineBundle | null;
}

export interface UsageSparklineSeries {
  labels: string[];
  requests: number[];
  tokens: number[];
  rpm: number[];
  tpm: number[];
  cacheReadRate: Array<number | null>;
  cost: number[];
}

// Geist：Sparkline 统一为纯黑 1.5px 细线、无填充；深色模式由 lib/chartjs 反相为浅灰。
const SPARKLINE_MONO = { border: '#000000', background: 'transparent' } as const;
export const SPARKLINE_COLORS = {
  requests: SPARKLINE_MONO,
  tokens: SPARKLINE_MONO,
  rpm: SPARKLINE_MONO,
  tpm: SPARKLINE_MONO,
  cacheReadRate: SPARKLINE_MONO,
  cost: SPARKLINE_MONO,
} as const;

const normalizeSparklineNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
};

const normalizeNullableSparklineNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return normalizeSparklineNumber(value);
};

export function buildUsageSparklineSeries({ usage }: Omit<UseSparklinesOptions, 'loading'>): UsageSparklineSeries {
  if (!usage?.series) {
    return { labels: [], requests: [], tokens: [], rpm: [], tpm: [], cacheReadRate: [], cost: [] };
  }

  const labels = usage.series.buckets ?? [];
  if (!labels.length) {
    return { labels: [], requests: [], tokens: [], rpm: [], tpm: [], cacheReadRate: [], cost: [] };
  }

  return {
    labels,
    requests: labels.map((_, index) => normalizeSparklineNumber(usage.series?.requests?.[index])),
    tokens: labels.map((_, index) => normalizeSparklineNumber(usage.series?.tokens?.[index])),
    rpm: labels.map((_, index) => normalizeSparklineNumber(usage.series?.rpm?.[index])),
    tpm: labels.map((_, index) => normalizeSparklineNumber(usage.series?.tpm?.[index])),
    cacheReadRate: labels.map((_, index) => normalizeNullableSparklineNumber(usage.series?.cache_read_rate?.[index])),
    cost: labels.map((_, index) => normalizeSparklineNumber(usage.series?.cost?.[index])),
  };
}

export function useSparklines({ usage, loading }: UseSparklinesOptions): UseSparklinesReturn {
  const series = useMemo(
    () => buildUsageSparklineSeries({ usage }),
    [usage]
  );

  const buildSparkline = useCallback(
    (
      input: { labels: string[]; data: Array<number | null> },
      color: string,
      backgroundColor: string
    ): SparklineBundle | null => {
      if (loading || !input?.data?.length) {
        return null;
      }
      return {
        data: {
          labels: input.labels,
          datasets: [
            {
              data: input.data,
              borderColor: color,
              backgroundColor,
              fill: false,
              tension: 0.45,
              pointRadius: 0,
              borderWidth: 1.5
            }
          ]
        }
      };
    },
    [loading]
  );

  const requestsSparkline = useMemo(
    () => buildSparkline({ labels: series.labels, data: series.requests }, SPARKLINE_COLORS.requests.border, SPARKLINE_COLORS.requests.background),
    [buildSparkline, series.labels, series.requests]
  );

  const tokensSparkline = useMemo(
    () => buildSparkline({ labels: series.labels, data: series.tokens }, SPARKLINE_COLORS.tokens.border, SPARKLINE_COLORS.tokens.background),
    [buildSparkline, series.labels, series.tokens]
  );

  const rpmSparkline = useMemo(
    () => buildSparkline({ labels: series.labels, data: series.rpm }, SPARKLINE_COLORS.rpm.border, SPARKLINE_COLORS.rpm.background),
    [buildSparkline, series.labels, series.rpm]
  );

  const tpmSparkline = useMemo(
    () => buildSparkline({ labels: series.labels, data: series.tpm }, SPARKLINE_COLORS.tpm.border, SPARKLINE_COLORS.tpm.background),
    [buildSparkline, series.labels, series.tpm]
  );

  const cacheReadRateSparkline = useMemo(
    () => buildSparkline({ labels: series.labels, data: series.cacheReadRate }, SPARKLINE_COLORS.cacheReadRate.border, SPARKLINE_COLORS.cacheReadRate.background),
    [buildSparkline, series.cacheReadRate, series.labels]
  );

  const costSparkline = useMemo(
    () => buildSparkline({ labels: series.labels, data: series.cost }, SPARKLINE_COLORS.cost.border, SPARKLINE_COLORS.cost.background),
    [buildSparkline, series.labels, series.cost]
  );

  return {
    requestsSparkline,
    tokensSparkline,
    rpmSparkline,
    tpmSparkline,
    cacheReadRateSparkline,
    costSparkline
  };
}
