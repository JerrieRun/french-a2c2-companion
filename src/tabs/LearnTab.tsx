import { SrsFlashcardDeck } from '../components/SrsFlashcardDeck';
import { GrammarPractice } from '../components/GrammarPractice';
import { ListeningPractice } from '../components/ListeningPractice';
import { WritingPractice } from '../components/WritingPractice';
import type { SrsGrade } from '../lib/srs';
import type { FlashcardSrs, GrammarExercise, WordCandidate } from '../types';

type LearnTabProps = {
  wordBook: WordCandidate[];
  flashcardSrs: Record<string, FlashcardSrs>;
  onSrsReview: (word: string, grade: SrsGrade) => void;
  onExportWordBook: () => void;
  onImportWordBook: (text: string, fileName: string) => void;
  writingLoading: boolean;
  writingResult: string | null;
  writingPrompt?: string | null;
  onWritingCorrection: (text: string) => void;
  grammarLoading: boolean;
  grammarExercises: GrammarExercise[] | null;
  onGrammarGenerate: (level: string, topic: string) => void;
};

export function LearnTab({
  wordBook,
  flashcardSrs,
  onSrsReview,
  onExportWordBook,
  onImportWordBook,
  writingLoading,
  writingResult,
  writingPrompt,
  onWritingCorrection,
  grammarLoading,
  grammarExercises,
  onGrammarGenerate,
}: LearnTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SrsFlashcardDeck
        words={wordBook}
        srs={flashcardSrs}
        onSrsReview={onSrsReview}
        onExportWordBook={onExportWordBook}
        onImportWordBook={onImportWordBook}
      />
      <GrammarPractice loading={grammarLoading} exercises={grammarExercises} onGenerate={onGrammarGenerate} />
      <WritingPractice loading={writingLoading} result={writingResult} onCorrect={onWritingCorrection} initialPrompt={writingPrompt} />
      <ListeningPractice />
    </div>
  );
}
