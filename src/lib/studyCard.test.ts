import { describe, it, expect } from 'vitest';
import type { UnitSection } from '../types';
import { extractGrammarSections, pickKeySentences, pickWritingSentences } from './studyCard';

const unit: UnitSection = {
  title: 'Unité 1',
  summary: '',
  excerpt: '',
  sentences: [
    'Bonjour. Comment ça va ?',
    "Bien qu'il soit fatigué, il a terminé son rapport avant la date limite, ce qui a impressionné toute l'équipe.",
    'Les étudiants qui ont participé au projet ont découvert que la coopération permettait de résoudre des problèmes complexes.',
    "On peut affirmer que le développement durable joue un rôle essentiel dans notre société moderne, car il garantit un avenir viable pour les générations futures.",
    'Il faut absolument réduire notre consommation d’énergie afin de protéger l’environnement.',
    'Ce phénomène, qui s’explique par plusieurs facteurs économiques et sociaux, mérite une analyse approfondie.',
    'Petite phrase.',
  ],
  vocabulary: [],
  practice: [],
};

describe('pickKeySentences 重点长难句', () => {
  it('优先挑选带从句/复杂结构的句子', () => {
    const picked = pickKeySentences(unit, 4);
    expect(picked.length).toBeGreaterThanOrEqual(3);
    // 短句（Petite phrase / Bonjour）不应入选
    expect(picked.some(p => p.fr.includes('Petite phrase'))).toBe(false);
    expect(picked.some(p => p.fr.includes('Bonjour'))).toBe(false);
    // 每句都带中文翻译与解析
    for (const p of picked) {
      expect(p.fr.length).toBeGreaterThan(0);
      expect(p.zh.length).toBeGreaterThan(0);
      expect(p.analysis.length).toBeGreaterThan(0);
    }
  });
});

describe('pickWritingSentences 写作积累句', () => {
  it('优先挑选含议论文常用表达的句子', () => {
    const picked = pickWritingSentences(unit, 4);
    expect(picked.length).toBeGreaterThanOrEqual(2);
    // 含 On peut / Il faut 等表达的句子应被选中
    expect(picked.some(p => /On peut|Il faut|il faut/i.test(p.fr))).toBe(true);
    for (const p of picked) {
      expect(p.fr.length).toBeGreaterThan(0);
      expect(p.zh.length).toBeGreaterThan(0);
      expect(p.usage.length).toBeGreaterThan(0);
    }
  });

  it('句子不足时也能返回（不会崩溃）', () => {
    const empty: UnitSection = { title: 'x', summary: '', excerpt: '', sentences: ['Aa. Bb. Cc.'], vocabulary: [], practice: [] };
    const picked = pickWritingSentences(empty, 4);
    expect(Array.isArray(picked)).toBe(true);
  });
});

describe('extractGrammarSections', () => {
  it('提取单元内全部 Grammaire 小节（含字母间距碎片标题）', () => {
    const md = [
      '# Unité 1',
      '## Documents',
      'texte de la leçon…',
      'Gra Gra Gr Gr Grammaire Grammaire Gr Gr am am',
      '### Le passé composé',
      'On le forme avec être ou avoir…',
      '## Grammaire',
      '### La phrase négative',
      'ne… pas…',
      '## Lexique',
      'les mots de la leçon',
    ].join('\n');
    const g = extractGrammarSections(md);
    expect(g).toContain('Le passé composé');
    expect(g).toContain('La phrase négative');
    // 两个小节都在
    const parts = g.split('---');
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it('没有 Grammaire 时返回空', () => {
    expect(extractGrammarSections('## Vocabulaire\nrien')).toBe('');
  });
});
