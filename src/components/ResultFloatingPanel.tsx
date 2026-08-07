import { useEffect, useState } from 'react';
import type { IntensiveAnalysis, WordLookupResult } from '../types';

type ResultFloatingPanelProps = {
  intensive: IntensiveAnalysis | null;
  loading: boolean;
  onClose: () => void;
  word: WordLookupResult | null;
  wordLoading: boolean;
  onAddWord: (word: string) => void;
  onCloseWord: () => void;
};

function PanelHeader({ icon, title, onClose }: { icon: string; title: string; onClose: () => void }) {
  return (
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
  );
}

/** 教材精读悬浮面板：点击查词（释义/搭配/变位 + 加入生词本）与精析结果，可点 X 关闭 */
export function ResultFloatingPanel(props: ResultFloatingPanelProps) {
  const { intensive, loading, onClose, word, wordLoading, onAddWord, onCloseWord } = props;
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setAdded(false);
  }, [word?.word]);

  if (!intensive && !loading && !word && !wordLoading) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex max-h-[75vh] w-full max-w-md flex-col items-end gap-3">
      {/* 点击查词卡片 */}
      {(word || wordLoading) && (
        <div className="pointer-events-auto flex w-full flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <PanelHeader icon="📖" title={`单词查询${word ? ` · ${word.word}` : ''}`} onClose={onCloseWord} />
          <div className="max-h-[38vh] overflow-auto px-4 py-3">
            {wordLoading ? (
              <p className="text-sm text-slate-500">查词中…</p>
            ) : word ? (
              <div className="space-y-3 text-sm">
                {!!word.defs.length && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400">释义{word.defs.length > 1 ? '（📍 为文中义）' : ''}</p>
                    <ol className="mt-1 space-y-1">
                      {word.defs.map((d, i) => (
                        <li key={i} className="leading-6 text-slate-800">
                          {i === 0 ? <span className="mr-1">📍</span> : <span className="mr-1 inline-block w-3 text-slate-400">{i + 1}.</span>}
                          {d}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {!!word.collocations.length && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400">常用搭配</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 leading-6 text-slate-700">
                      {word.collocations.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {word.isVerb && !!word.conjugation.length && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400">动词变位</p>
                    <div className="mt-1 space-y-1.5">
                      {word.conjugation.map((t, i) => (
                        <div key={i} className="rounded-xl bg-slate-50 px-2.5 py-1.5">
                          <p className="text-xs font-bold text-coral">{t.tense}</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-700">{t.forms.join(' · ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          {word && (
            <div className="border-t border-slate-100 px-4 py-2.5">
              <button
                type="button"
                disabled={added}
                onClick={() => { onAddWord(word.word); setAdded(true); }}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  added ? 'bg-emerald-100 text-emerald-700' : 'bg-gradient-to-r from-warm to-coral text-white hover:opacity-90'
                }`}
              >
                {added ? '✅ 已加入生词本' : '➕ 加入生词本'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 精析卡片 */}
      {(intensive || loading) && (
        <div className="pointer-events-auto flex w-full flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <PanelHeader icon="🧩" title="精析" onClose={onClose} />
          <div className="max-h-[40vh] overflow-auto px-4 py-3">
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
      )}
    </div>
  );
}
