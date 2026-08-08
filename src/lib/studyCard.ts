/**
 * 学习卡辅助：在没有 DeepSeek Key 时，从本单元课文里本地提取
 * 「重点长难句」与「写作积累句」，保证详细学习卡两类句子始终有内容。
 */
import type { UnitSection } from '../types';
import { translateSentence } from './words';

/** 从课文句子中挑选「重点长难句」：结构复杂（从句/分词/倒装等）或足够长 */
export function pickKeySentences(unit: UnitSection, max = 6): Array<{ fr: string; zh: string; analysis: string }> {
  const sentences = (unit.sentences ?? []).filter(s => s && s.trim().length > 0);
  const complexMarkers = /\b(que|qui|dont|où|lequel|laquelle|lesquels|dont|alors que|bien que|parce que|puisque|pour que|afin que|à condition que|si |quand|lorsque|pendant que|avant que|après que|ce qui|ce que|ce dont)\b/i;
  const scored = sentences
    .map(s => {
      const trimmed = s.trim();
      const words = trimmed.split(/\s+/).length;
      const hasComplex = complexMarkers.test(trimmed);
      // 评分：复杂结构优先，其次句子长度
      const score = (hasComplex ? 3 : 0) + Math.min(words / 20, 2) + (trimmed.length > 90 ? 1 : 0);
      return { fr: trimmed, words, score, hasComplex };
    })
    .filter(x => x.words >= 12 && (x.hasComplex || x.words >= 20))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, max).map(x => ({
    fr: x.fr,
    zh: translateSentence(x.fr),
    analysis: x.hasComplex
      ? '长句：包含从句/连接结构，建议先找主句主干（主语+谓语+宾语），再拆解从句与修饰成分，注意时态与语式配合。'
      : '长句：先提取主干，再理解修饰成分（分词、介词短语、关系从句），翻译时按中文语序调整。',
  }));
}

/** 从课文句子中挑选「写作积累句」：含议论文常用表达，可直接套用 */
export function pickWritingSentences(unit: UnitSection, max = 6): Array<{ fr: string; zh: string; usage: string }> {
  const sentences = (unit.sentences ?? []).filter(s => s && s.trim().length > 0);
  const usefulMarkers = /\b(il (est|faut|vaut)|il est important|on peut|on doit|c'est pourquoi|afin de|grâce à|à cause de|par exemple|en revanche|d'une part|d'autre part|selon|certes|en effet|il s'agit de|permet de|tend à|joue un rôle|au lieu de|malgré|bien que|pour conclure|en conclusion)\b/i;
  const withMarker = sentences.filter(s => usefulMarkers.test(s)).slice(0, max);
  const picked = withMarker.length >= 3
    ? withMarker
    : withMarker.concat(sentences.slice(0, max)).slice(0, max);

  return picked.map(fr => ({
    fr: fr.trim(),
    zh: translateSentence(fr.trim()),
    usage: /(il (est|faut|vaut)|il est important|on peut|on doit)/i.test(fr)
      ? '议论文表达观点/提出建议时可套用。'
      : /par exemple|afin de|grâce à|permet de/i.test(fr)
        ? '举例/说明因果或方法时可套用。'
        : /en revanche|certes|bien que|malgré|d'une part|d'autre part/i.test(fr)
          ? '议论文让步/对比转折时可套用。'
          : '可作为本单元主题相关的写作素材积累。',
  }));
}

/** 从单元 Markdown 片段中提取「Grammaire」章节（含标题行），用于保证语法精华完整覆盖教材语法 */
export function extractGrammarSection(markdown: string, maxChars = 4000): string {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  const idx = lines.findIndex(l => /^\s*#{1,6}\s*Grammaire\b/i.test(l) || /^\s*GRAMMAIRE\s*$/i.test(l.trim()));
  if (idx < 0) return '';
  // 到下一个标题（且与起始标题相隔至少几行）为止
  let end = -1;
  for (let i = idx + 1; i < lines.length; i += 1) {
    if (/^\s*#{1,6}\s+\S/.test(lines[i]) && i - idx > 3) {
      end = i;
      break;
    }
  }
  const section = lines.slice(idx, end < 0 ? undefined : end).join('\n').trim();
  return section.slice(0, maxChars);
}
