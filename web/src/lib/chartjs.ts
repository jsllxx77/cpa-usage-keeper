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
// react-chartjs-2 会复用 dataset 对象并 Object.assign 新属性，因此逐键记录“原值 / 上次写入值”：
// 当前值 !== 上次写入值 说明业务侧改过颜色（如高亮），以当前值作为新的原值。
const COLOR_KEYS = ['borderColor', 'backgroundColor', 'hoverBackgroundColor', 'pointBackgroundColor', 'pointBorderColor'] as const;
type ColorKey = (typeof COLOR_KEYS)[number];
const colorState = new WeakMap<object, Partial<Record<ColorKey, { original: unknown; written: unknown }>>>();

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
      let state = colorState.get(dataset);
      if (!state) colorState.set(dataset, (state = {}));
      for (const key of COLOR_KEYS) {
        if (!(key in record)) continue;
        const entry = state[key];
        const original = entry && record[key] === entry.written ? entry.original : record[key];
        const written = mapColor(original, isDark);
        state[key] = { original, written };
        record[key] = written;
      }

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
