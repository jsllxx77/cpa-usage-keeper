import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  LogarithmicScale,
  PointElement,
  ScatterController,
  Title,
  Tooltip,
} from 'chart.js';
import { resolveUsageChartColor } from '@/utils/usage/chartConfig';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  LineController,
  ScatterController,
  BarElement,
  BarController,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// Geist 图表规范：细线（1.5px）、低透明度虚线格线。集中在注册处统一处理，
// 避免逐个修改业务图表的 options，减少与上游同步时的冲突面。
const GEIST_GRID_DASH = [3, 3];
const GEIST_LINE_WIDTH = 1.5;

// Chart.js v4 的 border.dash 同时作用于网格线；业务 options 未显式设置时生效。
// defaults.scale 为所有笛卡尔坐标轴的公共基准；其类型声明未包含 border，这里做窄化断言。
(ChartJS.defaults.scale as unknown as { border: { dash: number[] } }).border.dash = GEIST_GRID_DASH;
ChartJS.defaults.elements.line.borderWidth = GEIST_LINE_WIDTH;

// 业务色板以浅色模式灰阶为基准；深色模式下把数据集颜色映射为对应的反相灰阶。
// 原值保存在 WeakMap 中，保证多次 update 与主题来回切换都可重复计算。
const COLOR_KEYS = ['borderColor', 'backgroundColor', 'hoverBackgroundColor', 'pointBackgroundColor', 'pointBorderColor'] as const;
const originalColors = new WeakMap<object, Partial<Record<(typeof COLOR_KEYS)[number], unknown>>>();

const mapColor = (value: unknown, isDark: boolean): unknown => {
  if (typeof value === 'string') return resolveUsageChartColor(value, isDark);
  if (Array.isArray(value)) return value.map((item) => mapColor(item, isDark));
  if (typeof value === 'function') {
    return (...args: unknown[]) => mapColor((value as (...input: unknown[]) => unknown)(...args), isDark);
  }
  return value;
};

const isDarkTheme = () => document.documentElement.getAttribute('data-theme') === 'dark';

ChartJS.register({
  id: 'geistChartStyle',
  // 数据集控制器在 beforeUpdate 之后才构建，此处的修改会作用到本次绘制。
  beforeUpdate(chart) {
    const isDark = isDarkTheme();
    for (const dataset of chart.data.datasets) {
      const record = dataset as unknown as Record<string, unknown>;
      let original = originalColors.get(dataset);
      if (!original) {
        original = {};
        for (const key of COLOR_KEYS) if (key in record) original[key] = record[key];
        originalColors.set(dataset, original);
      }
      for (const key of COLOR_KEYS) if (key in original) record[key] = mapColor(original[key], isDark);

      const type = (dataset as { type?: string }).type ?? (chart.config as { type?: string }).type;
      if (type !== 'line') continue;
      if (typeof record.borderWidth !== 'number' || record.borderWidth > GEIST_LINE_WIDTH) record.borderWidth = GEIST_LINE_WIDTH;
    }
  },
});

// 部分图表（如指标卡 Sparkline）的 options 不随主题变化；主题切换时统一重绘。
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  new MutationObserver(() => {
    for (const chart of Object.values(ChartJS.instances)) chart.update('none');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
