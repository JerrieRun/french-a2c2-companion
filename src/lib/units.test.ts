import { describe, it, expect } from 'vitest';
import { buildLocalUnitsFromText, detectDominantPattern, splitPages, splitSentences } from './units';

/** 构造带「第 N 页:」标记的教材全文（模拟 extractTextFromPdf 的 .trim() 输出，无前导换行） */
function makeText(pages: string[]): string {
  return pages.map((t, i) => `第 ${i + 1} 页:\n${t}`).join('\n\n');
}

describe('splitPages', () => {
  it('无前导换行也能识别第 1 页（App 会对全文 trim）', () => {
    const pages = splitPages(makeText(['封面', '正文', '第三页']));
    expect(pages.map(p => p.n)).toEqual([1, 2, 3]);
    expect(pages[0].text).toBe('封面');
    expect(pages[2].text).toBe('第三页');
  });

  it('无分页标记时作为单页', () => {
    const pages = splitPages('整段文本没有分页标记');
    expect(pages.length).toBe(1);
    expect(pages[0].n).toBe(1);
  });
});

describe('splitSentences', () => {
  it('在句号/感叹号/问号后切分', () => {
    const s = splitSentences('Bonjour. Comment ça va ? Très bien !');
    expect(s).toEqual(['Bonjour.', 'Comment ça va ?', 'Très bien !']);
  });

  it('不在编号 "M." / "3." / "a." 后误切', () => {
    const s = splitSentences('M. Dupont habite ici. 3. Répondez. a. Oui. b. Non.');
    // "M. Dupont" 不切；"3. Répondez" 因大写 R 会切（可接受）；"a." 后是小写不切
    expect(s.join(' ')).toContain('M. Dupont');
    expect(s.join(' ')).toContain('a. Oui');
  });
});

describe('本地单元拆分', () => {
  it('无单元标记 → 整册作为一个单元', () => {
    const r = buildLocalUnitsFromText('Ceci est un texte simple. Il n’a pas de chapitre.');
    expect(r.units.length).toBe(1);
    expect(r.units[0].title).toBe('整册教材');
  });

  it('Édito 风格：多栏目录（每页 2 条 "Unité N p. XX"）+ 开篇页以 "Unité" 开头 → 12 单元且页码与目录一致', () => {
    // 目录页：两栏交错，每页只有 2 条带页码的条目
    const tocPages = [
      'Sommaire\nUnité 1 p. 13 Nouvelles vies • thème\nUnité 2 p. 27 Je me souviens • thème',
      'Sommaire\nUnité 3 p. 41 Comme à la maison • thème\nUnité 4 p. 53 Tous pareils • thème',
      'Sommaire\nUnité 5 p. 69 En route • thème\nUnité 6 p. 83 En cuisine • thème',
      'Sommaire\nUnité 7 p. 97 À votre santé • thème\nUnité 8 p. 111 Dans les médias • thème',
      'Sommaire\nUnité 9 p. 125 Consommer • thème\nUnité 10 p. 139 Envies • thème',
      'Sommaire\nUnité 11 p. 153 De jolis parcours • thème\nUnité 12 p. 167 Soif de nature • thème',
    ];
    const pages: string[] = [...tocPages];
    // 开篇页与目录页码一致：13, 27, 41, 53, 69, 83, 97, 111, 125, 139, 153, 167
    const startPages = [13, 27, 41, 53, 69, 83, 97, 111, 125, 139, 153, 167];
    startPages.forEach((start, idx) => {
      const n = idx + 1;
      while (pages.length < start) pages.push(`第 ${pages.length + 1} 页 填充内容.`);
      pages[start - 1] = `Unité Thème ${n} Objectifs o Parler. Nouvelles vies ${n}`;
    });
    while (pages.length < 170) pages.push(`第 ${pages.length + 1} 页 补充内容.`);

    const text = makeText(pages);
    const r = buildLocalUnitsFromText(text);
    expect(r.units.length).toBe(12);
    expect(r.units[0].startPage).toBe(13);
    expect(r.units[1].startPage).toBe(27);
    expect(r.units[11].startPage).toBe(167);
    expect(r.units[0].title).toContain('Unité 1');
    expect(r.units[0].sentences.length).toBeGreaterThan(0);
    expect(r.units[11].endPage).toBe(170);
  });

  it('无目录时：页首出现 "Unité N" 标记 → 按页首拆分', () => {
    const pages: string[] = [];
    for (let n = 1; n <= 3; n += 1) {
      pages.push(`Unité ${n} Le thème ${n}\nObjectifs. Contenu du chapitre ${n}.`);
      pages.push(`Suite du chapitre ${n}.`);
    }
    const r = buildLocalUnitsFromText(makeText(pages));
    expect(r.units.length).toBe(3);
    expect(r.units[0].startPage).toBe(1);
    expect(r.units[1].startPage).toBe(3);
    expect(r.units[2].startPage).toBe(5);
  });

  it('中文「第 N 单元」也能识别', () => {
    const pages = ['第 1 单元 第一课\n内容甲。', '第 2 单元 第二课\n内容乙。'];
    const r = buildLocalUnitsFromText(makeText(pages));
    expect(r.units.length).toBe(2);
    expect(r.units[0].title).toContain('第 1 单元');
    expect(r.units[0].startPage).toBe(1);
  });

  it('Dossier 结构（法语教材常见）也能识别', () => {
    const pages: string[] = [];
    for (let n = 1; n <= 3; n += 1) {
      pages.push(`Dossier ${n} Le thème ${n}\nContenu du dossier ${n}.`);
    }
    const r = buildLocalUnitsFromText(makeText(pages));
    expect(r.units.length).toBe(3);
    expect(r.units[0].title).toContain('Dossier 1');
  });

  it('检测主导模式：Unité 出现最多', () => {
    const text = makeText(['Unité 1 A. Unité 2 B. Unité 3 C.', 'Unité 4 D.']);
    const pages = splitPages(text);
    const p = detectDominantPattern(pages);
    expect(p?.key).toBe('unite');
  });
});
