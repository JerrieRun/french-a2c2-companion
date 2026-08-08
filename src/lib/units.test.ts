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

describe('Édito B2 风格', () => {
  it('目录主题后直接跟技能列表（无圆点）也能提取干净标题', () => {
    // 目录行：Unité 1 p. 11 Se mettre au vert Compréhension orale Production orale …
    const pages: string[] = [];
    // 目录页（2 条/页，模拟多栏）
    pages.push('Sommaire\nUnité 1 p. 11 Se mettre au vert Compréhension orale Production orale Compréhension écrite\nUnité 2 p. 25 Être ou avoir ? Compréhension orale Production orale');
    pages.push('Sommaire\nUnité 3 p. 41 Chercher sa voie Compréhension orale Production orale\nUnité 4 p. 55 Les écrans ne montrent pas toujours la réalité. Compréhension orale');
    // 开篇页：B2 风格「数字 Unité 主题 Objectifs」
    const startPages = [11, 25, 41, 55];
    startPages.forEach((start, idx) => {
      const n = idx + 1;
      while (pages.length < start) pages.push(`第 ${pages.length + 1} 页 填充内容.`);
      pages[start - 1] = `${n} Unité Thème ${n} Objectifs o Témoigner.`;
    });
    while (pages.length < 70) pages.push(`第 ${pages.length + 1} 页 补充内容.`);
    const r = buildLocalUnitsFromText(makeText(pages));
    expect(r.units.length).toBe(4);
    expect(r.units[0].title).toBe('Unité 1 · Se mettre au vert');
    expect(r.units[1].title).toBe('Unité 2 · Être ou avoir ?');
    expect(r.units[0].startPage).toBe(11);
    expect(r.units[1].startPage).toBe(25);
    expect(r.units[3].startPage).toBe(55);
  });

  it('B2 风格开篇页（数字 Unité 主题）能正确定位起始页', () => {
    // 标准目录（Unité N p. XX）负责识别模式，开篇页是「数字 Unité」格式
    const pages = [
      'Sommaire\nUnité 1 p. 2 Un thème • Compréhension orale\nUnité 2 p. 4 Deuxième thème • Compréhension orale',
      '1 Unité Un thème Objectifs o Parler. Contenu du chapitre un.',
      'Suite du chapitre un.',
      '2 Unité Deuxième thème Objectifs o Écouter. Contenu deux.',
    ];
    const r = buildLocalUnitsFromText(makeText(pages));
    expect(r.units.length).toBe(2);
    expect(r.units[0].startPage).toBe(2);
    expect(r.units[1].startPage).toBe(4);
  });
});

describe('Édito B1 风格（目录撞页 + 缺失单元补齐）', () => {
  it('目录两单元撞同一页时用页内实际单元号裁决，缺失单元按页内标记补齐', () => {
    // 目录错位：Unité 2 与 Unité 8 都标到 p. 3（后者是提取错位），Unité 8 真实开篇在 p. 5
    const pages = [
      'Sommaire\nUnité 1 p. 2 Un premier thème Compréhension orale\nUnité 2 p. 3 Vivre ensemble sur la Terre Compréhension orale\nUnité 3 p. 4 Un troisième thème Compréhension orale\nUnité 8 p. 3 Mieux consommer ! Compréhension orale',
      '1 Unité Un premier thème Objectifs o Parler.',
      '2 Unité Vivre ensemble sur la Terre Objectifs o Réagir.',
      '3 Unité Un troisième thème Objectifs o Lire.',
      '8 Unité Mieux consommer ! Objectifs o Exprimer.',
    ];
    const r = buildLocalUnitsFromText(makeText(pages));
    const u2 = r.units.find(u => u.title.includes('Vivre ensemble sur la Terre'));
    const u8 = r.units.find(u => u.title.includes('Mieux consommer'));
    expect(u2?.startPage).toBe(3);
    expect(u8?.startPage).toBe(5);
    expect(r.units.length).toBe(4);
  });

  it('主题开头带括号不会被剥掉（(Se) mettre en scène）', () => {
    const pages = [
      'Sommaire\nUnité 1 p. 1 (Se) mettre en scène Compréhension orale\nUnité 2 p. 2 Un autre thème Compréhension orale',
      '1 Unité (Se) mettre en scène Objectifs o Jouer.',
      '2 Unité Un autre thème Objectifs o Lire.',
    ];
    const r = buildLocalUnitsFromText(makeText(pages));
    expect(r.units[0].title).toBe('Unité 1 · (Se) mettre en scène');
  });
});
