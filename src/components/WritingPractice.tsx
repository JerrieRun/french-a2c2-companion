import { useEffect, useState } from 'react';

type WritingPracticeProps = {
  loading: boolean;
  result: string | null;
  onCorrect: (text: string) => void;
  initialPrompt?: string | null;
};

export function WritingPractice({ loading, result, onCorrect, initialPrompt }: WritingPracticeProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (initialPrompt) setText(initialPrompt);
  }, [initialPrompt]);

  return (
    <article className="rounded-[28px] bg-cream p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">写作批改 ✍️</h3>
      <p className="mt-2 text-sm text-slate-600">写一段法语，DeepSeek 帮你检查语法、用词与表达。</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Écrivez quelques phrases en français…"
        rows={4}
        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-900 outline-none focus:border-sky"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">{text.length} 字符</span>
        <button
          type="button"
          disabled={loading || !text.trim()}
          onClick={() => onCorrect(text)}
          className="rounded-2xl bg-gradient-to-r from-warm to-coral px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
        >
          {loading ? '批改中…' : '开始批改 ✨'}
        </button>
      </div>
      {result && (
        <div className="mt-3 rounded-2xl border border-sky/40 bg-white p-3">
          <p className="text-xs font-semibold text-slate-500">📝 批改结果</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{result}</p>
        </div>
      )}
    </article>
  );
}
