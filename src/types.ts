export type TabKey = 'learn' | 'materials' | 'path' | 'progress';

/** 学习路径课时完成进度：key 为 `${单元索引}:${课时索引}` */
export type PathProgress = Record<string, boolean>;

export type UnitSection = {
  title: string;
  summary: string;
  excerpt: string;
  sentences: string[];
  vocabulary: WordCandidate[];
  practice: string[];
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
