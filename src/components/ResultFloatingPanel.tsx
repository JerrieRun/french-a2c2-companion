import type { ReactNode } from 'react';
import type { AnalysisResult } from '../types';

type ResultFloatingPanelProps = {
  translation: string | null;
  translationLoading: boolean;
  wordDetail: string | null;
  wordDetailLoading: boolean;
  analysis: AnalysisResult | null;
  analysisLoading: boolean;
  onCloseTranslation: () => void;
  onCloseWordDetail: () => void;
  onCloseAnalysis: () => void;
};

function Card({
  icon, title, loading, onClose, children,
}: {
  icon: string; title: string; loading: boolean; onClose: () => void; children: ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
        <p className="text-xs font-semibold text-slate-500">{icon} {title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="rounded-xl px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
      <div className="max-h-[38vh] overflow-auto px-4 py-3">
        {loading ? <p className="text-sm text-slate-500">生成中…</p> : children}
      </div>
    </div>
  );
}

/** 教材精读结果悬浮面板：翻译 / 单词详解 / 句型分析，看完可点 X 关闭，不打断阅读 */
export function ResultFloatingPanel(props: ResultFloatingPanelProps) {
  const {
    translation, translationLoading,
    wordDetail, wordDetailLoading,
    analysis, analysisLoading,
    onCloseTranslation, onCloseWordDetail, onCloseAnalysis,
  } = props;

  const hasAny =
    translation || wordDetail || analysis || translationLoading || wordDetailLoading || analysisLoading;
  if (!hasAny) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-3">
      {(translation || translationLoading) && (
        <div className="pointer-events-auto w-full max-w-md">
          <Card icon="🌐" title="翻译结果" loading={translationLoading} onClose={onCloseTranslation}>
            {translation && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{translation}</p>}
          </Card>
        </div>
      )}
      {(wordDetail || wordDetailLoading) && (
        <div className="pointer-events-auto w-full max-w-md">
          <Card icon="📖" title="单词 / 短语详解" loading={wordDetailLoading} onClose={onCloseWordDetail}>
            {wordDetail && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{wordDetail}</p>}
          </Card>
        </div>
      )}
      {(analysis || analysisLoading) && (
        <div className="pointer-events-auto w-full max-w-md">
          <Card icon="🧩" title="句型分析" loading={analysisLoading} onClose={onCloseAnalysis}>
            {analysis && (
              <div className="space-y-3 text-sm">
                <p className="text-slate-700">{analysis.summary}</p>
                {!!analysis.grammarPoints?.length && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500">语法亮点</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
                      {analysis.grammarPoints.map((g, i) => <li key={i}>{g}</li>)}
                    </ul>
                  </div>
                )}
                {!!analysis.commonMistakes?.length && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500">常见错误</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
                      {analysis.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
