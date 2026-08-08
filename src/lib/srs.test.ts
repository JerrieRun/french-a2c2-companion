import { describe, it, expect } from 'vitest';
import { createSrs, gradeSrs, isDue, intervalLabel } from './srs';

const DAY = 24 * 60 * 60 * 1000;

describe('srs 间隔重复', () => {
  it('创建默认状态', () => {
    const s = createSrs('parler', '说', 'A2');
    expect(s.ease).toBe(2.5);
    expect(s.interval).toBe(0);
    expect(s.mastery).toBe(0);
    expect(s.due).toBe(0);
  });

  it('again 重置间隔并降低难度', () => {
    const s = gradeSrs(createSrs('x', 'y', 'B2'), 'again', 1000);
    expect(s.interval).toBe(0);
    expect(s.ease).toBe(2.3);
    expect(s.lapses).toBe(1);
    expect(s.due).toBe(1000);
  });

  it('good 先 1 天，再按难度系数增长', () => {
    const s1 = gradeSrs(createSrs('x', 'y', 'B2'), 'good', 0);
    expect(s1.interval).toBe(1);
    const s2 = gradeSrs(s1, 'good', 1000);
    expect(s2.interval).toBe(Math.ceil(1 * 2.5));
    expect(s2.due).toBe(1000 + s2.interval * DAY);
    expect(s2.mastery).toBe(2);
  });

  it('easy 首次给 3 天', () => {
    const s = gradeSrs(createSrs('x', 'y', 'B2'), 'easy', 0);
    expect(s.interval).toBe(3);
  });

  it('isDue 判断', () => {
    expect(isDue(undefined)).toBe(true);
    const fresh = createSrs('x', 'y', 'B2');
    expect(isDue(fresh, Date.now())).toBe(true);
    const scheduled = gradeSrs(fresh, 'good', Date.now());
    expect(isDue(scheduled, Date.now())).toBe(false);
  });

  it('intervalLabel 文案', () => {
    expect(intervalLabel(0)).toBe('今天再学');
    expect(intervalLabel(3)).toBe('3 天后');
    expect(intervalLabel(0.5)).toMatch(/小时/);
  });
});
