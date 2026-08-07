export type TabKey = 'learn' | 'materials' | 'path' | 'progress';

/** 学习路径课时完成进度：key 为 `${单元索引}:${课时索引}` */
export type PathProgress = Record<string, boolean>;

/** 分类词汇组中的单个词条 */
export type VocabItem = {
  word: string;
  translation: string;
  /** 用法/例句（可选） */
  example?: string;
};

/** 分类词汇表（如「家庭关系」「环保与可持续」） */
export type VocabGroup = {
  category: string;
  items: VocabItem[];
};

/** 语法精华主题（含可选的表格，表格首行为表头） */
export type GrammarTopic = {
  title: string;
  explanation: string;
  table?: string[][];
};

/** 常见错误提醒：错句 → 正确句 */
export type MistakePair = {
  wrong: string;
  right: string;
  note?: string;
};

/** 中法对照实用例句 */
export type BilingualSentence = {
  zh: string;
  fr: string;
};

export type UnitSection = {
  title: string;
  summary: string;
  excerpt: string;
  sentences: string[];
  vocabulary: WordCandidate[];
  practice: string[];
  /** 分类核心词汇表（DeepSeek 生成的学习卡） */
  vocabGroups?: VocabGroup[];
  /** 语法精华总结（DeepSeek 生成的学习卡） */
  grammarTopics?: GrammarTopic[];
  /** 常见错误与提醒（DeepSeek 生成的学习卡） */
  commonMistakes?: MistakePair[];
  /** 中法对照实用例句（DeepSeek 生成的学习卡） */
  exampleSentences?: BilingualSentence[];
  /** 单元对应的 PDF 起始页（1 基） */
  startPage?: number;
  /** 单元对应的 PDF 结束页（1 基） */
  endPage?: number;
  /** 单元全题型练习（DeepSeek 生成，覆盖 DELF/DALF/TCF 主要题型） */
  practiceSections?: UnitPractice;
};

export type MaterialPreview = {
  title: string;
  pages: number;
  excerpt: string;
  sentences: string[];
  units: UnitSection[];
};

export type WordCandidate = {
  text: string;
  cefr: 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  translation: string;
  frequency: number;
};

export type AnalysisResult = {
  summary: string;
  grammarPoints: string[];
  commonMistakes: string[];
  debug?: {
    sentence: string;
    promptPreview: string;
  };
};

export type GrammarExercise = {
  question: string;
  answer: string;
};

export type AnalysisRecord = {
  sentence: string;
  summary: string;
  grammarPoints: string[];
  commonMistakes: string[];
  analyzedAt: string;
  promptPreview?: string;
  practiceExercises?: string[];
};

/** 练习条目：题干 + 选项 + 答案 + 解析 */
export type PracticeItem = {
  question: string;
  options?: string[];
  answer: string;
  explain?: string;
};

/** 句子重组/排序题 */
export type OrderingItem = {
  sentences: string[];
  answer: string; // 如 "2-1-4-3"
  explain?: string;
};

/** 改错题 */
export type CorrectionItem = {
  wrong: string;
  right: string;
  note?: string;
};

/** 单元练习：覆盖法语考级（DELF B2 / DALF C1 / TCF）主要题型 */
export type UnitPractice = {
  /** 听力理解 */
  listening?: { instructions: string; transcript?: string; items: PracticeItem[] };
  /** 阅读理解 */
  reading?: { passage: string; items: PracticeItem[] };
  /** 语法与结构 */
  grammar?: { items: PracticeItem[] };
  /** 完形填空 */
  cloze?: { title: string; text: string; items: PracticeItem[] };
  /** 词汇与表达 */
  vocabulary?: { items: PracticeItem[] };
  /** 句子重组 */
  ordering?: { items: OrderingItem[] };
  /** 改错 */
  correction?: { items: CorrectionItem[] };
  /** 书面表达（含写作复述） */
  writing?: { prompt: string; tips: string[]; modelAnswer: string };
  /** 口语表达（含复述/独白） */
  oral?: { prompt: string; points: string[]; modelAnswer: string };
};
