// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { Chart as ChartJS } from 'chart.js';
import '../chartjs';

type Dataset = Record<string, unknown>;
type GeistPlugin = { beforeUpdate: (chart: unknown) => void };

const plugin = () => ChartJS.registry.getPlugin('geistChartStyle') as unknown as GeistPlugin;

// react-chartjs-2 更新时复用同一 dataset 对象并 Object.assign 新属性，这里模拟该路径。
const run = (datasets: Dataset[], type = 'bar') => plugin().beforeUpdate({ data: { datasets }, config: { type } });

afterEach(() => document.documentElement.removeAttribute('data-theme'));

describe('geistChartStyle plugin', () => {
  it('keeps colors that callers change on a reused dataset object', () => {
    const dataset: Dataset = { borderColor: '#0070f3', backgroundColor: '#0070f3' };
    run([dataset]);
    Object.assign(dataset, { borderColor: '#e93d82', backgroundColor: '#e93d82' });
    run([dataset]);
    expect(dataset.borderColor).toBe('#e93d82');
    expect(dataset.backgroundColor).toBe('#e93d82');
  });

  it('maps greys in dark mode and restores them in light mode', () => {
    const dataset: Dataset = { borderColor: '#000000' };
    document.documentElement.setAttribute('data-theme', 'dark');
    run([dataset]);
    expect(dataset.borderColor).toBe('#ededed');
    document.documentElement.removeAttribute('data-theme');
    run([dataset]);
    expect(dataset.borderColor).toBe('#000000');
  });

  it('does not wrap scriptable colors repeatedly across updates', () => {
    const fill = () => '#000000';
    const dataset: Dataset = { backgroundColor: fill };
    document.documentElement.setAttribute('data-theme', 'dark');
    for (let i = 0; i < 5; i++) run([dataset]);
    expect((dataset.backgroundColor as () => string)()).toBe('#ededed');
  });

  it('clamps line widths to 1.5px and leaves bars alone', () => {
    const line: Dataset = { type: 'line', borderWidth: 2 };
    const bar: Dataset = { borderWidth: 2 };
    run([line, bar]);
    expect(line.borderWidth).toBe(1.5);
    expect(bar.borderWidth).toBe(2);
  });
});
