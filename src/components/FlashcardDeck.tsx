import { useMemo, useState } from 'react';
import type { WordCandidate } from '../types';

type FlashcardDeckProps = {
  words: WordCandidate[];
  mastery: Record<string, number>;
  onMasteryChange: (word: string, delta: number) => void;
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function FlashcardDeck({ words, mastery, onMasteryChange }: FlashcardDeckProps) {
  const [order, setOrder] = useState(() => shuffle(words.map((_, i) => i)));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ known: 0, again: 0 });

  if (words.length === 0) {
    return (
      <article className="rounded-[28px] bg-cream p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">单词闪卡 🃏</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          生词本还是空的。先去「教材中心」上传教材并点选收藏生词，回到这里就能用闪卡复习。
        </p>
      </article>
    );
  }

  const done = index >= order.length;
  const current = words[order[Math.min(index, order.length - 1)]];

  const advance = (delta: 1 | -1) => {
    onMasteryChange(current.text, delta);
    setStats(s => (delta === 1 ? { ...s, known: s.known + 1 } : { ...s, again: s.again + 1 }));
    setFlipped(false);
    setIndex(i => i + 1);
  };

  const restart = () => {
    setOrder(shuffle(words.map((_, i) => i)));
    setIndex(0);
    setFlipped(false);
    setStats({ known: 0, again: 0 });
  };

  return (
    <article className="rounded-[28px] bg-cream p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">单词闪卡 🃏</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">{words.length} 词</span>
      </div>

      {done ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">本轮完成！</p>
          <p className="mt-2 text-sm text-slate-600">
            记住 {stats.known} 词 · 需复习 {stats.again} 词
          </p>
          <button
            type="button"
            onClick={restart}
            className="mt-4 rounded-2xl bg-gradient-to-r from-warm to-coral px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            再来一轮 🔄
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-warm to-coral transition-all"
                style={{ width: `${((index + 1) / order.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {index + 1} / {order.length}
            </span>
          </div>

          <div
            className="flashcard-scene mt-4 h-56 w-full cursor-pointer select-none"
            onClick={() => setFlipped(f => !f)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setFlipped(f => !f);
              }
            }}
          >
            <div className={`flashcard-inner relative h-full w-full ${flipped ? 'flipped' : ''}`}>
              <div className="flashcard-face absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">点击翻面</p>
                <p className="mt-3 text-center text-3xl font-semibold text-slate-900">{current.text}</p>
                <p className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">频次 {current.frequency}</p>
              </div>
              <div className="flashcard-face flashcard-back absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-coral/30 bg-white p-6 shadow-sm">
                <p className="text-center text-2xl font-semibold text-slate-900">{current.translation}</p>
                <p className="mt-3 rounded-full bg-sky/40 px-3 py-1 text-xs font-semibold text-slate-700">{current.cefr}</p>
                <p className="mt-3 text-xs text-slate-400">熟练度 {mastery[current.text] ?? 0} / 5</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => advance(-1)}
              className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
            >
              再练一次 🔁
            </button>
            <button
              type="button"
              onClick={() => advance(1)}
              className="flex-1 rounded-2xl bg-gradient-to-r from-warm to-coral px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              记住了 ✓
            </button>
          </div>
        </>
      )}
    </article>
  );
}
