import { useState } from 'react';

type UnitPracticeCardProps = {
  practice: string[];
};

export function UnitPracticeCard({ practice }: UnitPracticeCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900"
      >
        <span>单元练习建议</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          {open ? '收起' : '展开'}
        </span>
      </button>
      {open && (
        <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-slate-700">
          {practice.length ? practice.map((item, idx) => (
            <li key={idx}>{item}</li>
          )) : (
            <li className="text-slate-500">暂无练习建议。</li>
          )}
        </ul>
      )}
    </div>
  );
}
