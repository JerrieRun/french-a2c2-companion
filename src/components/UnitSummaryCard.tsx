import { useState } from 'react';

type UnitSummaryCardProps = {
  title: string;
  summary: string;
};

export function UnitSummaryCard({ title, summary }: UnitSummaryCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">单元摘要</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{title}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="mt-4 text-sm leading-7 text-slate-700">
          {summary || '暂无摘要内容，可上传教材后刷新以生成摘要。'}
        </div>
      )}
    </div>
  );
}
