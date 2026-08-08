/**
 * 词汇相关的纯函数：CEFR 粗略分级、小型翻译字典、词频候选提取。
 * 从 App.tsx 抽出，便于单元测试与复用。
 */
import type { WordCandidate } from '../types';

/** 按词长粗略估计 CEFR 等级（无外部词表时的启发式） */
export function getCeFrTag(word: string): WordCandidate['cefr'] {
  if (word.length <= 4) return 'A2';
  if (word.length <= 6) return 'B1';
  if (word.length <= 8) return 'B2';
  if (word.length <= 10) return 'C1';
  return 'C2';
}

/** 小型内置法汉词典（常见词兜底翻译） */
export function translateWord(word: string): string {
  const dictionary: Record<string, string> = {
    bonjour: '你好',
    merci: '谢谢',
    amour: '爱情',
    "aujourd'hui": '今天',
    toujours: '总是',
    français: '法语',
    écrire: '写',
    parler: '说',
    maison: '房子',
    voyage: '旅行',
    histoire: '历史',
    important: '重要',
    malheureusement: '不幸地',
    cependant: '然而',
  };
  return dictionary[word] ?? '待补充';
}

/** 从文本中提取高频词候选（过滤停用词与过短词） */
export function extractWordCandidates(text: string): WordCandidate[] {
  const normalized = text.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿæœ\s]/gi, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  const stopwords = new Set(['de', 'la', 'le', 'et', 'les', 'des', 'un', 'une', 'en', 'du', 'que', 'qui', 'pour', 'dans', 'est', 'pas', 'sur', 'se', 'il', 'elle', 'au', 'aux']);
  const frequencyMap = words.reduce<Record<string, number>>((acc, word) => {
    if (word.length <= 2 || stopwords.has(word)) return acc;
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(frequencyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, freq]) => ({
      text: word,
      frequency: freq,
      cefr: getCeFrTag(word),
      translation: translateWord(word),
    }));
}

/** 逐词翻译（用于简单的中文对照预览） */
export function translateSentence(sentence: string): string {
  return sentence
    .split(/\s+/)
    .map(token => translateWord(token.replace(/[^a-zàâçéèêëîïôûùüÿæœ]/gi, '').toLowerCase()) || token)
    .join(' ');
}
