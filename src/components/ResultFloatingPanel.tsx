import type { IntensiveAnalysis } from '../types';

type ResultFloatingPanelProps = {
  intensive: IntensiveAnalysis | null;
  loading: boolean;
  onClose: () => void;
};

/** 教材精读「精析」结果悬浮面板：先翻译，再句型精析；可点 X 关闭，不打断阅读 */
export function ResultFloatingPanel({ intensive, loading, onClose }: ResultFloatingPanelProps) {
  if (!intensive && !loading) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-3">
      <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <p className="text-xs font-semibold text-slate-500">🧩 精析</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-xl px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[55vh] overflow-auto px-4 py-3">
          {loading ? (
            <p className="text-sm text-slate-500">精析中：先翻译，再拆解句法…</p>
          ) : intensive ? (
            <div className="space-y-4 text-sm">
              {intensive.sentence && (
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-400">原文</p>
                  <p className="mt-1 leading-6 text-slate-800">{intensive.sentence}</p>
                </div>
              )}
              {intensive.translation && (
                <div>
                  <p className="text-xs font-semibold text-slate-400">🌐 中文翻译</p>
                  <p className="mt-1 leading-6 text-slate-800">{intensive.translation}</p>
                </div>
              )}
              {intensive.summary && (
                <div>
                  <p className="text-sm font-semibold text-slate-900">🧩 分析此句</p>
                  <p className="mt-1 leading-6 text-slate-700">{intensive.summary}</p>
                </div>
              )}
              {!!intensive.grammarPoints?.length && (
                <div>
                  <p className="text-sm font-semibold text-slate-900">语法亮点</p>
                  <ul className="mt-1.5 list-disc space-y-1.5 pl-4 leading-6 text-slate-700">
                    {intensive.grammarPoints.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
              )}
              {!!intensive.commonMistakes?.length && (
                <div>
                  <p className="text-sm font-semibold text-slate-900">常见错误</p>
                  <ul className="mt-1.5 list-disc space-y-1.5 pl-4 leading-6 text-slate-700">
                    {intensive.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
