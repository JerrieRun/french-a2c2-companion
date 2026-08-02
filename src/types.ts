export type TabKey = 'learn' | 'materials' | 'progress';

export type UnitSection = {
  title: string;
  summary: string;
  excerpt: string;
  sentences: string[];
  vocabulary: WordCandidate[];
  practice: string[];
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

export type AnalysisRecord = {
  sentence: string;
  summary: string;
  grammarPoints: string[];
  commonMistakes: string[];
  analyzedAt: string;
  promptPreview?: string;
  practiceExercises?: string[];
};
