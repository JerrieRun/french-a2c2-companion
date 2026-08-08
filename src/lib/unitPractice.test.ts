import { describe, it, expect } from 'vitest';
import { buildLocalPractice, detectLevel, normalizePractice } from './unitPractice';
import type { UnitSection } from '../types';

const unit: UnitSection = {
  title: 'Unité 1',
  summary: '摘要',
  excerpt: '摘要',
  sentences: ['Bonjour le monde.', 'Il faut que tu fasses tes devoirs.'],
  vocabulary: [
    { text: 'parler', cefr: 'A2', translation: '说', frequency: 3 },
    { text: 'société', cefr: 'B2', translation: '社会', frequency: 2 },
  ],
  practice: ['题目'],
};

describe('unitPractice', () => {
  it('detectLevel 从文件名推断等级', () => {
    expect(detectLevel('Édito B2 méthode.pdf')).toBe('B2');
    expect(detectLevel('foo.pdf')).toBe('B2');
    expect(detectLevel('ABC C1.pdf')).toBe('C1');
  });

  it('normalizePractice 保留 questionZh 并过滤无效项', () => {
    const p = normalizePractice({
      listening: { instructions: 'Écoutez', instructionsZh: '听', items: [
        { question: 'Vrai ou faux ?', questionZh: '对错？', answer: 'Vrai', explain: '解析' },
        { question: '', answer: 'x' },
      ] },
      vocabulary: { items: 'bad' },
    });
    expect(p.listening?.instructionsZh).toBe('听');
    expect(p.listening?.items).toHaveLength(1);
    expect(p.listening?.items[0].questionZh).toBe('对错？');
    expect(p.vocabulary).toBeUndefined();
  });

  it('buildLocalPractice 生成全部 9 类题型', () => {
    const p = buildLocalPractice(unit);
    expect(p.listening).toBeTruthy();
    expect(p.reading).toBeTruthy();
    expect(p.grammar).toBeTruthy();
    expect(p.cloze).toBeTruthy();
    expect(p.vocabulary).toBeTruthy();
    expect(p.ordering).toBeTruthy();
    expect(p.correction).toBeTruthy();
    expect(p.writing).toBeTruthy();
    expect(p.oral).toBeTruthy();
    expect(p.vocabulary?.items.length).toBeGreaterThan(0);
    expect(p.writing?.prompt).toContain('Unité 1');
  });
});
