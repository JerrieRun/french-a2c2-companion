import { useState } from 'react';
import type { GrammarExercise } from '../types';

const LEVELS = ['A2', 'B1', 'B2', 'C1', 'C2'];
const TOPIC_CHIPS = ['时态', '虚拟式', '条件式', '代词', '关系从句', '被动语态', '间接引语', '否定式'];

type GrammarPracticeProps = {
  loading: boolean;
  exercises: GrammarExercise[] | null;
  onGenerate: (level: string, topic: string) => void;
};

export function GrammarPractice({ loading, exercises, onGenerate }: GrammarPracticeProps) {
  const [level, setLevel] = useState('B1');
  const [topic, setTopic] = useState('时态');
  const [answersOpen, setAnswersOpen] = useState<Set<number>>(new Set());

  const toggleAnswer = (idx: number) => {
    setAnswersOpen(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <article className="rounded-[28px] bg-cream p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">语法练习 📖</h3>
      <p className="mt-2 text-sm text-slate-600">按 CEFR 等级与主题生成练习题，先作答再对答案。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {LEVELS.map(l => (
          <button
            key={l}
            type="button"
            onClick={() => setLevel(l)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${level === l ? 'bg-coral text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {TOPIC_CHIPS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${topic === t ? 'bg-lavender text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={() => onGenerate(level, topic)}
        className="mt-4 w-full rounded-2xl bg-gradient-to-r from-warm to-coral px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
      >
        {loading ? '生成中…' : `生成 ${level} · ${topic} 练习 🎯`}
      </button>
      {exercises && exercises.length > 0 && (
        <div className="mt-4 space-y-3">
          {exercises.map((ex, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-sm leading-6 text-slate-800">{idx + 1}. {ex.question}</p>
              <button
                type="button"
                onClick={() => toggleAnswer(idx)}
                className="mt-2 rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                {answersOpen.has(idx) ? '隐藏答案' : '显示答案'}
              </button>
              {answersOpen.has(idx) && ex.answer && (
                <p className="mt-2 rounded-xl bg-sky/20 p-3 text-sm leading-6 text-slate-800">✓ {ex.answer}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
