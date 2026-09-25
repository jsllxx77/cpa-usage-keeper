/**
 * Chart.js configuration utilities for usage statistics
 * Extracted from UsagePage.tsx for reusability
 */

import type { ChartOptions } from 'chart.js';

// Geist 灰阶图表色板：同一序列内按明度拉开层次，仅成功/警告/危险保留低饱和功能色。
// 色值为浅色模式基准；深色模式经 resolveUsageChartColor 映射为同明度层级的反相灰阶。
export const USAGE_CHART_REQUESTS_LINE_COLOR = '#000000';

export interface UsageChartGradientColor {
  base: string;
  light: string;
}

const gray = (value: string): UsageChartGradientColor => ({ base: value, light: value });

export const USAGE_CHART_COMPOSITION_COLORS: UsageChartGradientColor[] = [
  gray('#000000'),
  gray('#8f8f8f'),
  gray('#3d3d3d'),
  gray('#c7c7c7'),
  gray('#666666'),
  gray('#e0e0e0'),
];
export const USAGE_CHART_TOKEN_COLORS = {
  input: gray('#000000'),
  output: gray('#666666'),
  cacheRead: gray('#a8a8a8'),
  cacheWrite: gray('#d4d4d4'),
  reasoning: gray('#3d3d3d'),
  requests: USAGE_CHART_REQUESTS_LINE_COLOR,
  cost: '#8f8f8f',
};

export const USAGE_CHART_REALTIME_COLORS = {
  input: gray('#000000'),
  output: gray('#45a557'),
  cacheRead: gray('#a8a8a8'),
  cacheWrite: gray('#d4d4d4'),
} as const;

// 深色画布上把黑色系映射为对应的浅色，保持同样的明度层级。
const DARK_CHART_COLOR_MAP: Record<string, string> = {
  '#000000': '#ededed',
  '#3d3d3d': '#c2c2c2',
  '#666666': '#9e9e9e',
  '#8f8f8f': '#707070',
  '#a8a8a8': '#5c5c5c',
  '#c7c7c7': '#474747',
  '#d4d4d4': '#383838',
  '#e0e0e0': '#333333',
  '#45a557': '#62c073',
  '#e5484d': '#ff6166',
  '#f5a524': '#f5b544',
};

const isDarkDocument = () => typeof document !== 'undefined'
  && document.documentElement.getAttribute('data-theme') === 'dark';

export const resolveUsageChartColor = (color: string, isDark = isDarkDocument()) => (
  isDark ? DARK_CHART_COLOR_MAP[color.toLowerCase()] ?? color : color
);

// 保留原有 CanvasGradient 接口（测试与调用方依赖），Geist 下使用同色纯色填充。
export const toUsageChartGradientFill = (
  context: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } },
  color: UsageChartGradientColor,
) => {
  const { chart } = context;
  const base = resolveUsageChartColor(color.base);
  if (!chart.chartArea) return base;
  const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
  gradient.addColorStop(0, resolveUsageChartColor(color.light));
  gradient.addColorStop(1, base);
  return gradient;
};

export interface UsageChartTheme {
  textPrimary: string;
  textSecondary: string;
  grid: string;
  axis: string;
  averageLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipTitle: string;
  tooltipBody: string;
}

// Analysis 与其他业务图表共用同一组画布颜色，避免浅色和深色 Tooltip 各自漂移。
export const getUsageChartTheme = (isDark: boolean): UsageChartTheme => ({
  textPrimary: isDark ? '#f5f1e8' : '#111827',
  textSecondary: isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(17, 24, 39, 0.72)',
  // Geist：低透明度虚线格线（dash 在 lib/chartjs 统一设置），黑底白字微型 Tooltip；深色模式反相。
  grid: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
  axis: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.10)',
  averageLine: isDark ? 'rgba(237, 237, 237, 0.45)' : 'rgba(0, 0, 0, 0.35)',
  tooltipBg: isDark ? '#ededed' : '#000000',
  tooltipBorder: isDark ? '#ededed' : '#000000',
  tooltipTitle: isDark ? '#000000' : '#ffffff',
  tooltipBody: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(255, 255, 255, 0.78)',
});

export const buildUsageChartTooltipStyle = (chartTheme: UsageChartTheme) => ({
  backgroundColor: chartTheme.tooltipBg,
  titleColor: chartTheme.tooltipTitle,
  bodyColor: chartTheme.tooltipBody,
  footerColor: chartTheme.tooltipBody,
  borderColor: chartTheme.tooltipBorder,
  borderWidth: 0,
  cornerRadius: 6,
  padding: 8,
  titleFont: { size: 11, weight: 600 },
  bodyFont: { size: 11 },
  footerFont: { size: 11 },
  boxWidth: 6,
  boxHeight: 6,
  titleSpacing: 2,
  titleMarginBottom: 6,
  bodySpacing: 2,
  footerSpacing: 2,
  footerMarginTop: 6,
  displayColors: true,
  usePointStyle: true,
});

/**
 * Static sparkline chart options (no dependencies on theme/mobile)
 */
export const sparklineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  scales: { x: { display: false }, y: { display: false } },
  elements: { line: { tension: 0.45 }, point: { radius: 0 } }
};

export interface ChartConfigOptions {
  period: 'hour' | 'day';
  labels: string[];
  isDark: boolean;
  isMobile: boolean;
  valueFormatter?: (value: number) => string;
  tooltipValueFormatter?: (value: number) => string;
}

/**
 * Build chart options with theme and responsive awareness
 */
export function buildChartOptions({
  period,
  labels,
  isDark,
  isMobile,
  valueFormatter,
  tooltipValueFormatter
}: ChartConfigOptions): ChartOptions<'line'> {
  const pointRadius = isMobile ? 2 : 4;
  const tickFontSize = isMobile ? 10 : 12;
  const maxTickLabelCount = isMobile ? (period === 'hour' ? 8 : 6) : period === 'hour' ? 12 : 10;
  const chartTheme = getUsageChartTheme(isDark);

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...buildUsageChartTooltipStyle(chartTheme),
        callbacks: (valueFormatter || tooltipValueFormatter)
          ? {
              label: (context) => {
                const label = context.dataset.label ? `${context.dataset.label}: ` : '';
                const formatter = tooltipValueFormatter ?? valueFormatter;
                return `${label}${formatter ? formatter(Number(context.parsed.y ?? 0)) : ''}`;
              }
            }
          : undefined
      }
    },
    scales: {
      x: {
        grid: {
          color: chartTheme.grid,
          drawTicks: false
        },
        border: {
          color: chartTheme.axis
        },
        ticks: {
          color: chartTheme.textSecondary,
          font: { size: tickFontSize },
          maxRotation: isMobile ? 0 : 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: maxTickLabelCount,
          callback: (value) => {
            const index = typeof value === 'number' ? value : Number(value);
            const raw =
              Number.isFinite(index) && labels[index] ? labels[index] : typeof value === 'string' ? value : '';

            if (period === 'hour') {
              const [md, time] = raw.split(' ');
              if (!time) return raw;
              if (time.startsWith('00:')) {
                return md ? [md, time] : time;
              }
              return time;
            }

            if (isMobile) {
              const parts = raw.split('-');
              if (parts.length === 3) {
                return `${parts[1]}-${parts[2]}`;
              }
            }
            return raw;
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: chartTheme.grid
        },
        border: {
          color: chartTheme.axis
        },
        ticks: {
          color: chartTheme.textSecondary,
          font: { size: tickFontSize },
          callback: valueFormatter
            ? (value) => valueFormatter(Number(value))
            : undefined
        }
      }
    },
    elements: {
      line: {
        tension: 0.35,
        borderWidth: isMobile ? 1.5 : 2
      },
      point: {
        borderWidth: 2,
        radius: pointRadius,
        hoverRadius: 4
      }
    }
  };
}

/**
 * Calculate minimum chart width for hourly data on mobile devices
 */
export function getHourChartMinWidth(labelCount: number, isMobile: boolean): string | undefined {
  if (!isMobile || labelCount <= 0) return undefined;
  const perPoint = 56;
  const minWidth = Math.min(labelCount * perPoint, 3000);
  return `${minWidth}px`;
}
