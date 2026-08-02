import { FlashcardDeck } from '../components/FlashcardDeck';
import type { WordCandidate } from '../types';

type LearnTabProps = {
  wordBook: WordCandidate[];
  flashcardMastery: Record<string, number>;
  onFlashcardMasteryChange: (word: string, delta: number) => void;
};

export function LearnTab({ wordBook, flashcardMastery, onFlashcardMasteryChange }: LearnTabProps) {
  return (
<div className="grid gap-6 md:grid-cols-3">
  <FlashcardDeck
    words={wordBook}
    mastery={flashcardMastery}
    onMasteryChange={onFlashcardMasteryChange}
  />
  <article className="rounded-[28px] bg-cream p-5 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900">语法专题 📖</h3>
    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
      <li>🟢 A2：复合过去时、代词 y/en、比较级</li>
      <li>🟡 B1：条件式现在时、虚拟式入门、关系从句</li>
      <li>🟠 B2：虚拟式深化、被动语态、间接引语</li>
      <li>🔴 C1/C2：文学时态、省略句、语域转换</li>
    </ul>
  </article>
  <article className="rounded-[28px] bg-cream p-5 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900">听力 & 写作 🎧✍️</h3>
    <p className="mt-3 text-sm text-slate-600">TTS 听力、写作批改、句型造句。</p>
  </article>
</div>
  );
}
