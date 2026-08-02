import { useState } from 'react';

type VocabularyItem = {
  text: string;
  cefr: string;
  translation: string;
  frequency: number;
};

type UnitVocabularyCardProps = {
  vocabulary: VocabularyItem[];
};

export function UnitVocabularyCard({ vocabulary }: UnitVocabularyCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900"
      >
        <span>核心词汇</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {open ? '收起' : '展开'}
        </span>
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-sm text-slate-700">
          {vocabulary.length ? (
            vocabulary.map((word, idx) => (
              <div key={idx} className="rounded-3xl border border-slate-200 bg-cream p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{word.text}</p>
                    <p className="mt-1 text-xs text-slate-500">{word.translation} · {word.cefr}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">频次 {word.frequency}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-slate-500">暂无词汇候选，上传教材后自动生成。</p>
          )}
        </div>
      )}
    </div>
  );
}
