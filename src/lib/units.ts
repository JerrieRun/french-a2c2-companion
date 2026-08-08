/**
 * 本地单元拆分：把教材全文（含「第 N 页:」分页标记）切分为单元。
 *
 * 为什么不用简单的「全篇按 Unité N 切分」：
 *  - 每页页眉/页脚会重复出现「Unité 1」，导致一个单元被切成几十段；
 *  - 目录页也会产生大量虚假单元；
 *  - 不同教材结构不同（Unité / Dossier / Leçon / Chapitre / 第X单元 …）。
 *
 * 策略（按优先级）：
 *  1. 检测全篇出现最多的单元标记模式（Unité/Dossier/…）；
 *  2. 优先用目录（TOC）页解析「单元号 → 页码」映射（最可靠）；
 *  3. 无目录时退化为「页首出现标记」的单元起始页检测；
 *  4. 都没有则整册作为一个单元。
 */
import type { MaterialPreview, UnitSection, WordCandidate } from '../types';
import { extractWordCandidates } from './words';

export type LocalParseResult = {
  units: UnitSection[];
  pages: number;
  sentences: string[];
};

export type UnitPattern = {
  key: string;
  label: string;
  /** 全局正则：匹配「Unité 1」等，捕获组 1 = 单元数字 */
  find: RegExp;
  /** 页首匹配：从页面文本开头定位单元标记 */
  start: RegExp;
};

export const UNIT_PATTERNS: UnitPattern[] = [
  // 法语教材的章节标题/目录均为首字母大写；正文里的小写 "unité/chapitre 1" 引用不应匹配
  { key: 'unite', label: 'Unité', find: /\bUnit[eé]\s*(\d{1,2})\b/g, start: /^\s*Unit[eé]\s*(\d{1,2})\b/ },
  { key: 'dossier', label: 'Dossier', find: /\bDossier\s*(\d{1,2})\b/g, start: /^\s*Dossier\s*(\d{1,2})\b/ },
  { key: 'lecon', label: 'Leçon', find: /\bLe[çc]on\s*(\d{1,2})\b/g, start: /^\s*Le[çc]on\s*(\d{1,2})\b/ },
  { key: 'chapitre', label: 'Chapitre', find: /\bChapitre\s*(\d{1,2})\b/g, start: /^\s*Chapitre\s*(\d{1,2})\b/ },
  { key: 'sequence', label: 'Séquence', find: /\bS[ée]quence\s*(\d{1,2})\b/g, start: /^\s*S[ée]quence\s*(\d{1,2})\b/ },
  { key: 'mission', label: 'Mission', find: /\bMission\s*(\d{1,2})\b/g, start: /^\s*Mission\s*(\d{1,2})\b/ },
  { key: 'cn-unit', label: '第X单元', find: /第\s*(\d{1,2})\s*单元/g, start: /^\s*第\s*(\d{1,2})\s*单元/ },
  { key: 'unit-en', label: 'Unit', find: /\bUnit\s*(\d{1,2})\b/gi, start: /^\s*Unit\s*(\d{1,2})\b/i },
];

/** 把教材全文按「第 N 页:」标记拆成页面列表（无标记时作为单页）。
 *  注意：App 的 extractTextFromPdf 会对全文 .trim()，第一个标记可能没有前导换行，因此前导换行要可选。 */
export function splitPages(text: string): Array<{ n: number; text: string }> {
  const parts = text.split(/(?:\n\s*)?第\s*(\d+)\s*页:\s*/g);
  if (parts.length < 3) {
    const t = (text || '').replace(/\s+/g, ' ').trim();
    return t ? [{ n: 1, text: t }] : [];
  }
  const pages: Array<{ n: number; text: string }> = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const n = parseInt(parts[i], 10);
    if (!Number.isFinite(n)) continue;
    pages.push({ n, text: (parts[i + 1] || '').replace(/\s+/g, ' ').trim() });
  }
  return pages;
}

/** 某页文本里出现的不同单元号集合 */
function distinctNumbers(pageText: string, pattern: UnitPattern): Set<number> {
  const nums = new Set<number>();
  pattern.find.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.find.exec(pageText)) !== null) {
    const num = parseInt(m[1], 10);
    if (num >= 1 && num <= 40) nums.add(num);
  }
  return nums;
}

/** 统计全篇每种标记模式的出现次数，返回得分最高者（需 ≥ 阈值才算「有单元结构」） */
export function detectDominantPattern(pages: Array<{ n: number; text: string }>): UnitPattern | null {
  let best: UnitPattern | null = null;
  let bestScore = 0;
  for (const pattern of UNIT_PATTERNS) {
    let score = 0;
    for (const page of pages) score += distinctNumbers(page.text, pattern).size;
    if (score > bestScore) {
      bestScore = score;
      best = pattern;
    }
  }
  return bestScore >= 2 ? best : null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 从目录页解析「单元号 → 页码」；找不到足够条目返回空 Map */
export function extractTocMap(pages: Array<{ n: number; text: string }>, pattern: UnitPattern): Map<number, number> {
  const map = new Map<number, number>();
  // 优先「Unité N p. XX」；中文教材兼容「第 N 单元 第 XX 页」。
  // 注：目录常为多栏排版，单页文本可能只含 2 个单元条目，因此「≥2 条带页码的条目」即视为目录页。
  let withP: RegExp;
  if (pattern.key === 'cn-unit') {
    withP = /第\s*(\d{1,2})\s*单元\s*(?:第\s*)?(\d{1,3})\s*页/gi;
  } else {
    withP = new RegExp(escapeRegExp(pattern.label) + String.raw`\s*(\d{1,2})\s+p\.?\s*(\d{1,3})`, 'gi');
  }
  for (const page of pages) {
    withP.lastIndex = 0;
    let m: RegExpExecArray | null;
    const found: Array<[number, number]> = [];
    while ((m = withP.exec(page.text)) !== null) {
      const num = parseInt(m[1], 10);
      const pageNo = parseInt(m[2], 10);
      if (num >= 1 && num <= 40 && pageNo >= 1 && pageNo <= 2000) found.push([num, pageNo]);
    }
    if (found.length < 2) continue; // 不是目录页
    for (const [num, pageNo] of found) {
      if (!map.has(num)) map.set(num, pageNo);
    }
  }
  return map;
}

/** 从目录条目文本里提取单元主题（如 "Unité 1 p. 13 Nouvelles vies" → "Nouvelles vies"） */
function tocTheme(pageText: string, afterIndex: number, pattern: UnitPattern): string {
  const rest = pageText.slice(afterIndex).trim();
  if (!rest) return '';
  const stop = rest.search(/[•｜|。·]/);
  let candidate = stop >= 0 ? rest.slice(0, stop) : rest;
  candidate = candidate.replace(/\s{2,}/g, ' ').trim();
  // 去掉开头的中缀（如 "Nouvelles vies" 前可能残留小标题）
  candidate = candidate.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/, '').trim();
  return candidate.slice(0, 60);
}

/** 从单元开篇页提取主题（无目录时的兜底） */
function openerTheme(pageText: string, pattern: UnitPattern): string {
  let t = pageText.trim();
  t = t.replace(new RegExp('^' + escapeRegExp(pattern.label) + String.raw`\s*\d{0,2}\s*`, 'i'), '');
  const objIdx = t.search(/Objectifs|objectifs|Contenus|contenus|Au programme/i);
  if (objIdx > 0) t = t.slice(0, objIdx);
  t = t.replace(/\s*\d{1,2}\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  return t.slice(0, 60);
}

/** 全篇查找第一个以「标记 + 数字」开头的页（越界/无目录时的兜底） */
function findFirstStart(pages: Array<{ n: number; text: string }>, pattern: UnitPattern, num: number): number {
  const numStart = new RegExp('^' + escapeRegExp(pattern.label) + String.raw`\s*` + num + String.raw`\b`, 'i');
  for (let i = 0; i < pages.length; i += 1) {
    if (numStart.test(pages[i].text)) return i;
  }
  return 0;
}

/** 在提示页码附近寻找真正的单元起始页。
 *  目录给的页码通常就是开篇页：只要该页以标记开头（带或不带数字，如「Unité Faites des expériences…」）就直接采用；
 *  否则在 ±3 页内找以「标记 + 数字」开头的页；仍找不到（或提示页码越界，如目录页码与 PDF 页码偏差较大）则全篇兜底。 */
export function locateStartPage(pages: Array<{ n: number; text: string }>, pattern: UnitPattern, num: number, hintPageNo: number): number {
  const hintIdx = hintPageNo - 1;
  if (hintIdx < 0 || hintIdx >= pages.length) return findFirstStart(pages, pattern, num);
  const labelStart = new RegExp('^' + escapeRegExp(pattern.label) + String.raw`[\s\d]*`, 'i');
  if (labelStart.test(pages[hintIdx].text)) return hintIdx;
  const numStart = new RegExp('^' + escapeRegExp(pattern.label) + String.raw`\s*` + num + String.raw`\b`, 'i');
  const from = Math.max(0, hintIdx - 3);
  const to = Math.min(pages.length - 1, hintIdx + 3);
  for (let i = from; i <= to; i += 1) {
    if (numStart.test(pages[i].text)) return i;
  }
  return findFirstStart(pages, pattern, num);
}

/** 把长文本切分为句子（避免在 "M." / "3." / "a." 等编号后误切） */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])|(?<=[.!?])(?=\s+[A-ZÀ-ÖØ-Þ«"(0-9])/g)
    .map(item => item.trim())
    .filter(Boolean);
}

function makePractice(sentencesInUnit: string[]): string[] {
  return [
    `请翻译本单元第一句：“${sentencesInUnit[0] ?? ''}”。`,
    '请列出本单元中的 3 个核心词汇并说明用法。',
    '请写一句与本单元主题相关的法语句子。',
  ];
}

/**
 * 本地单元拆分主函数。
 * @param text 教材全文（可含「第 N 页:」标记）
 * @param opts.title 教材标题（用于 MaterialPreview）
 * @param opts.extractWords 词汇提取函数（默认用内置词频）
 */
export function buildLocalUnitsFromText(
  text: string,
  opts: { title?: string; extractWords?: (t: string) => WordCandidate[] } = {}
): LocalParseResult {
  const extractWords = opts.extractWords ?? extractWordCandidates;
  const pages = splitPages(text);
  const allSentences = splitSentences(pages.map(p => p.text).join(' '));

  if (pages.length === 0) {
    return {
      units: [{
        title: '整册教材',
        summary: '',
        excerpt: '',
        sentences: [],
        vocabulary: [],
        practice: makePractice([]),
      }],
      pages: 1,
      sentences: [],
    };
  }

  const pattern = detectDominantPattern(pages);
  if (!pattern) {
    return {
      units: [{
        title: '整册教材',
        summary: allSentences.slice(0, 4).join(' '),
        excerpt: allSentences.slice(0, 4).join(' '),
        sentences: allSentences,
        vocabulary: extractWords(text).slice(0, 6),
        practice: makePractice(allSentences),
      }],
      pages: pages.length,
      sentences: allSentences,
    };
  }

  // ① 目录映射
  const tocMap = extractTocMap(pages, pattern);
  const tocTitles = new Map<number, string>();
  if (tocMap.size >= 2) {
    for (const page of pages) {
      const tocIdx = new RegExp(escapeRegExp(pattern.label) + String.raw`\s*(\d{1,2})\s+p\.?\s*(\d{1,3})`, 'gi');
      tocIdx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = tocIdx.exec(page.text)) !== null) {
        const num = parseInt(m[1], 10);
        if (!tocTitles.has(num)) tocTitles.set(num, tocTheme(page.text, m.index + m[0].length, pattern));
      }
    }
  }

  let unitStarts: Array<{ num: number; pageIndex: number }> = [];
  if (tocMap.size >= 2) {
    for (const [num, pageNo] of tocMap) {
      unitStarts.push({ num, pageIndex: locateStartPage(pages, pattern, num, pageNo) });
    }
  } else {
    // ② 页首标记检测（跳过目录页）
    const added = new Set<number>();
    for (let i = 0; i < pages.length; i += 1) {
      if (distinctNumbers(pages[i].text, pattern).size >= 2) continue; // 跳过目录/索引页
      const m = pages[i].text.match(pattern.start);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num >= 1 && num <= 40 && !added.has(num)) {
          added.add(num);
          unitStarts.push({ num, pageIndex: i });
        }
      }
    }
  }

  unitStarts.sort((a, b) => a.pageIndex - b.pageIndex);

  // ③ 兜底：整册
  if (unitStarts.length === 0) {
    return {
      units: [{
        title: '整册教材',
        summary: allSentences.slice(0, 4).join(' '),
        excerpt: allSentences.slice(0, 4).join(' '),
        sentences: allSentences,
        vocabulary: extractWords(text).slice(0, 6),
        practice: makePractice(allSentences),
      }],
      pages: pages.length,
      sentences: allSentences,
    };
  }

  const units: UnitSection[] = [];
  for (let k = 0; k < unitStarts.length; k += 1) {
    const start = unitStarts[k];
    const endIdx = k + 1 < unitStarts.length ? unitStarts[k + 1].pageIndex : pages.length;
    const bodyPages = pages.slice(start.pageIndex, endIdx);
    const body = bodyPages.map(p => p.text).join(' ');
    const sentencesInUnit = splitSentences(body);

    let theme = tocTitles.get(start.num) ?? '';
    if (!theme && bodyPages[0]) theme = openerTheme(bodyPages[0].text, pattern);
    const title = `${pattern.label} ${start.num}${theme ? ` · ${theme}` : ''}`;

    units.push({
      title,
      summary: sentencesInUnit.slice(0, 3).join(' '),
      excerpt: sentencesInUnit.slice(0, 3).join(' '),
      sentences: sentencesInUnit,
      vocabulary: extractWords(body).slice(0, 6),
      practice: makePractice(sentencesInUnit),
      startPage: bodyPages[0]?.n,
      endPage: bodyPages[bodyPages.length - 1]?.n,
    });
  }

  return { units, pages: pages.length, sentences: allSentences };
}

/** 包装成本地解析的 MaterialPreview（标题/页数/摘要/句子/单元） */
export function buildLocalMaterialPreview(
  text: string,
  opts: { title?: string; extractWords?: (t: string) => WordCandidate[] } = {}
): MaterialPreview {
  const result = buildLocalUnitsFromText(text, opts);
  return {
    title: opts.title ?? '新教材',
    pages: result.pages,
    excerpt: result.sentences.slice(0, 4).join(' '),
    sentences: result.sentences,
    units: result.units,
  };
}
