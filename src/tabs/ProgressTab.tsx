import type { AnalysisRecord, WordCandidate } from '../types';

type ProgressTabProps = {
  analysisHistory: AnalysisRecord[];
  wordBook: WordCandidate[];
  expandedHistoryIndex: number | null;
  handleToggleHistory: (index: number) => void;
  handleDeleteHistory: (index: number) => void;
  handleClearHistory: () => void;
  handleExportHistory: () => void;
};

export function ProgressTab(props: ProgressTabProps) {
  const {
    analysisHistory,
    wordBook,
    expandedHistoryIndex,
    handleToggleHistory,
    handleDeleteHistory,
    handleClearHistory,
    handleExportHistory,
  } = props;
  return (
<div className="space-y-6">
  <div className="rounded-[28px] bg-cream p-6 shadow-sm">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">进度模块已扩展为复盘中心，展示你的分析历史与词汇收藏成长。</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExportHistory}
          className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm"
        >
          导出历史
        </button>
        <button
          type="button"
          onClick={handleClearHistory}
          className="rounded-2xl bg-rose-100 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm"
        >
          清空历史
        </button>
      </div>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-3">
      <div className="rounded-3xl bg-white p-4">
        <p className="text-sm text-slate-500">已分析句数</p>
        <p className="mt-3 text-3xl font-semibold text-slate-900">{analysisHistory.length}</p>
      </div>
      <div className="rounded-3xl bg-white p-4">
        <p className="text-sm text-slate-500">生词收藏</p>
        <p className="mt-3 text-3xl font-semibold text-slate-900">{wordBook.length}</p>
      </div>
      <div className="rounded-3xl bg-white p-4">
        <p className="text-sm text-slate-500">复盘进度</p>
        <p className="mt-3 text-3xl font-semibold text-slate-900">{Math.min(100, analysisHistory.length * 12)}%</p>
      </div>
    </div>
  </div>
  <div className="rounded-[28px] bg-white p-6 shadow-sm">
    <h3 className="text-xl font-semibold text-slate-900">最近分析记录</h3>
    <div className="mt-4 space-y-4">
      {analysisHistory.length ? analysisHistory.slice(0, 6).map((record, index) => {
        const isExpanded = expandedHistoryIndex === index;
        return (
          <div key={`${record.analyzedAt}-${index}`} className="rounded-3xl border border-slate-200 bg-cream p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">句子 {analysisHistory.length - index}</p>
                <p className="mt-2 text-sm text-slate-700">{record.sentence}</p>
                <p className="mt-2 text-xs text-slate-500">{new Date(record.analyzedAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleHistory(index)}
                  className="rounded-2xl bg-lavender px-3 py-1 text-xs font-semibold text-slate-900"
                >
                  {isExpanded ? '收起详情' : '展开详情'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteHistory(index)}
                  className="rounded-2xl bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
                >
                  删除
                </button>
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-700">{record.summary}</div>
            {isExpanded && (
              <div className="mt-4 rounded-3xl bg-white p-4 text-sm text-slate-700">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">语法亮点</p>
                    <ul className="mt-2 list-disc space-y-2 pl-4">
                      {record.grammarPoints.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">常见错误</p>
                    <ul className="mt-2 list-disc space-y-2 pl-4">
                      {record.commonMistakes.map((mistake, idx) => (
                        <li key={idx}>{mistake}</li>
                      ))}
                    </ul>
                  </div>
                  {record.practiceExercises?.length ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">已生成练习题</p>
                      <ul className="mt-2 list-decimal space-y-2 pl-4 text-sm text-slate-700">
                        {record.practiceExercises.map((question, idx) => (
                          <li key={idx}>{question}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {record.promptPreview && (
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Prompt 预览</p>
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        {record.promptPreview}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      }) : (
        <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">暂无分析记录，先在“教材中心”选择一道句子进行解析。</p>
      )}
    </div>
  </div>
</div>
  );
}
