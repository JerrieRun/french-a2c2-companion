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
