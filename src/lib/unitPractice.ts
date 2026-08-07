import type { CorrectionItem, OrderingItem, PracticeItem, UnitPractice, UnitSection } from '../types';

/** 从教材文件名推断 CEFR 等级，缺省 B2 */
export function detectLevel(name: string | null): string {
  const m = (name || '').match(/\b(A2|B1|B2|C1|C2)\b/i);
  return m ? m[1].toUpperCase() : 'B2';
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const strArr = (v: unknown): string[] => arr(v).map(str).filter(Boolean);

/** 规范化 DeepSeek 返回的练习 JSON，保证结构可用 */
export function normalizePractice(data: any): UnitPractice {
  const normItems = (v: unknown): PracticeItem[] =>
    arr(v)
      .map((it: any) => ({
        question: str(it?.question),
        options: Array.isArray(it?.options) ? it.options.map((o: unknown) => str(o)) : undefined,
        answer: str(it?.answer),
        explain: it?.explain ? str(it.explain) : undefined,
      }))
      .filter((it: { question: string; answer: string }) => it.question && it.answer);

  const normOrdering = (v: unknown): OrderingItem[] =>
    arr(v)
      .map((it: any) => ({
        sentences: strArr(it?.sentences),
        answer: str(it?.answer),
        explain: it?.explain ? str(it.explain) : undefined,
      }))
      .filter((it: { sentences: string[]; answer: string }) => it.sentences.length >= 2 && it.answer);

  const normCorrection = (v: unknown): CorrectionItem[] =>
    arr(v)
      .map((it: any) => ({
        wrong: str(it?.wrong),
        right: str(it?.right),
        note: it?.note ? str(it.note) : undefined,
      }))
      .filter((it: { wrong: string; right: string }) => it.wrong && it.right);

  return {
    listening: data?.listening
      ? { instructions: str(data.listening.instructions), transcript: str(data.listening.transcript), items: normItems(data.listening.items) }
      : undefined,
    reading: data?.reading
      ? { passage: str(data.reading.passage), items: normItems(data.reading.items) }
      : undefined,
    grammar: data?.grammar ? { items: normItems(data.grammar.items) } : undefined,
    cloze: data?.cloze
      ? { title: str(data.cloze.title), text: str(data.cloze.text), items: normItems(data.cloze.items) }
      : undefined,
    vocabulary: data?.vocabulary ? { items: normItems(data.vocabulary.items) } : undefined,
    ordering: data?.ordering ? { items: normOrdering(data.ordering.items) } : undefined,
    correction: data?.correction ? { items: normCorrection(data.correction.items) } : undefined,
    writing: data?.writing
      ? { prompt: str(data.writing.prompt), tips: strArr(data.writing.tips), modelAnswer: str(data.writing.modelAnswer) }
      : undefined,
    oral: data?.oral
      ? { prompt: str(data.oral.prompt), points: strArr(data.oral.points), modelAnswer: str(data.oral.modelAnswer) }
      : undefined,
  };
}

/** 无 DeepSeek Key 时的本地兜底：基于单元课文/词汇生成基础练习模板 */
export function buildLocalPractice(unit: UnitSection): UnitPractice {
  const sentences = unit.sentences?.filter(Boolean) ?? [];
  const vocab = unit.vocabulary?.filter(v => v.text) ?? [];
  const vocabWords = vocab.slice(0, 8);
  const grammarTitles = unit.grammarTopics?.map(t => t.title).filter(Boolean) ?? [];
  const text = sentences.slice(0, 6).join(' ');
  const summary = unit.summary || sentences[0] || unit.title;

  // 词汇单选题：正确释义 + 两个干扰项
  const vocabularyItems: PracticeItem[] = vocabWords.map((w, i) => {
    const distractors = vocabWords
      .filter((_, j) => j !== i)
      .slice(0, 2)
      .map(x => x.translation);
    return {
      question: `法语单词「${w.text}」最接近的中文意思是？`,
      options: [w.translation, ...distractors],
      answer: w.translation,
      explain: `词义：${w.translation}（CEFR ${w.cefr}）`,
    };
  });

  // 语法/完形：把课文句子里的一个长词挖空
  const blankItems: PracticeItem[] = sentences.slice(0, 4).map(sentence => {
    const words = sentence.split(/\s+/).filter(w => w.length >= 6);
    const target = words[Math.floor(words.length / 2)] || '';
    if (!target) return { question: `请用本单元学过的表达写一个句子：${sentence}`, answer: '（自由作答）' };
    const clean = target.replace(/[.,;:!?«»""'']/g, '');
    return {
      question: sentence.replace(clean, '____'),
      options: [clean, '（其他选项由 DeepSeek 生成）'],
      answer: clean,
      explain: `填词：${clean}`,
    };
  });

  // 句子排序：取 3-4 句课文打乱
  const orderSentences = sentences.slice(0, 4);
  const orderingItems: OrderingItem[] =
    orderSentences.length >= 3
      ? [{
          sentences: [...orderSentences].reverse(),
          answer: orderSentences.map((_, i) => i + 1).join('-'),
          explain: '按课文出现顺序排列。',
        }]
      : [];

  return {
    listening: {
      instructions: '点击「▶ 播放课文」听录音（也可先到「朗读跟读」模块练习），然后概括本单元主题。',
      transcript: text,
      items: [
        { question: '听完后，用 1-2 句中文概括本单元主题。', answer: summary, explain: '参考答案即单元摘要。' },
        { question: '录音中是否提到本单元的核心话题？请判断正误：本单元围绕「' + (unit.title || '主题') + '」展开。', options: ['A. 正确', 'B. 错误'], answer: 'A. 正确', explain: '本单元课文即围绕该主题。' },
      ],
    },
    reading: {
      passage: text,
      items: [
        { question: '用自己的话（法语）复述这段课文，2-3 句即可。', answer: summary, explain: '可参考单元摘要。' },
        { question: '在文中找出至少 3 个动词，写出它们的不定式。', answer: '（自由作答，可对照课文）', explain: '复习动词变位时重点关注。' },
      ],
    },
    grammar: {
      items: grammarTitles.length
        ? grammarTitles.map(title => ({ question: `请用语法点「${title}」造一个与本单元主题相关的句子。`, answer: '（自由作答）', explain: `语法点：${title}。建议配置 DeepSeek Key 获取带答案解析的题目。` }))
        : blankItems,
    },
    cloze: {
      title: '课文填空',
      text: blankItems.map(it => it.question).join(' '),
      items: blankItems,
    },
    vocabulary: { items: vocabularyItems },
    ordering: { items: orderingItems },
    correction: {
      items: [
        { wrong: "J'ai allé au marché hier.", right: "Je suis allé au marché hier.", note: 'aller 用 être 作助动词。' },
        { wrong: 'Il faut que tu fais tes devoirs.', right: 'Il faut que tu fasses tes devoirs.', note: 'après « il faut que » → subjonctif。' },
      ],
    },
    writing: {
      prompt: `书面表达（写作复述）：请围绕本单元主题「${unit.title}」写一段 120-180 词的法语短文（${summary.slice(0, 60)}…）。要求：先复述课文要点，再补充你的观点；使用本单元核心词汇（${vocabWords.slice(0, 4).map(v => v.text).join('、')}）。`,
      tips: [
        '先用 2-3 句复述课文/素材的要点。',
        '使用本单元学到的词汇与表达，避免逐字翻译中文。',
        "注意段落结构与连接词（d'abord, ensuite, enfin…）。",
      ],
      modelAnswer: '（参考范文由 DeepSeek 生成；配置 API Key 后可获得完整范文与批改）',
    },
    oral: {
      prompt: `口语表达（复述与独白）：请就本单元主题「${unit.title}」做 2 分钟法语独白：先复述课文内容，再表达自己的看法。`,
      points: [
        "开头：引入主题（Le sujet d'aujourd'hui est…）。",
        '中间：复述课文 2-3 个要点，再用 1-2 个论据支持你的观点。',
        '结尾：总结并给出结论（En conclusion…）。',
      ],
      modelAnswer: '（参考表达由 DeepSeek 生成）',
    },
  };
}
