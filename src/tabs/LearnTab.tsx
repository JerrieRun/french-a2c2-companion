import { FlashcardDeck } from '../components/FlashcardDeck';
import { GrammarPractice } from '../components/GrammarPractice';
import { ListeningPractice } from '../components/ListeningPractice';
import { WritingPractice } from '../components/WritingPractice';
import type { GrammarExercise, WordCandidate } from '../types';

type LearnTabProps = {
  wordBook: WordCandidate[];
  flashcardMastery: Record<string, number>;
  onFlashcardMasteryChange: (word: string, delta: number) => void;
  writingLoading: boolean;
  writingResult: string | null;
  onWritingCorrection: (text: string) => void;
  grammarLoading: boolean;
  grammarExercises: GrammarExercise[] | null;
  onGrammarGenerate: (level: string, topic: string) => void;
};

export function LearnTab({
  wordBook,
  flashcardMastery,
  onFlashcardMasteryChange,
  writingLoading,
  writingResult,
  onWritingCorrection,
  grammarLoading,
  grammarExercises,
  onGrammarGenerate,
}: LearnTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <FlashcardDeck words={wordBook} mastery={flashcardMastery} onMasteryChange={onFlashcardMasteryChange} />
      <GrammarPractice loading={grammarLoading} exercises={grammarExercises} onGenerate={onGrammarGenerate} />
      <WritingPractice loading={writingLoading} result={writingResult} onCorrect={onWritingCorrection} />
      <ListeningPractice />
    </div>
  );
}
