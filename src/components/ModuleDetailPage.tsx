import { useEffect, useState } from 'react';
import type { AnalysisResult, PathProgress, UnitSection, WordCandidate } from '../types';
import { LESSONS } from '../lib/lessons';
import { speakFrench, stopSpeaking } from '../lib/tts';
import { UnitPracticePage } from './UnitPracticePage';

type ModuleDetailPageProps = {
  unit: UnitSection;
  unitIndex: number;
  lessonIndex: number;
  level: string;
  hasApiKey: boolean;
  progress: PathProgress;
  onToggleProgress: (unit: number, lesson: number) => void;
  onClose: () => void;
  onGoNext: (lessonIndex: number) => void;
  onOpenUnitInPdf: (unitIndex: number) => void;
  onGoLearn: () => void;
  onAddUnitWords: (unitIndex: number) => number;
  wordBook: WordCandidate[];
  onAddWordbookItem: (text: string, translation: string, cefr?: string) => void;
  onGenerateUnitModule: (unitIndex: number) => Promise<void>;
  unitModuleLoading: number | null;
  onAnalyzeSentence: (sentence: string) => Promise<AnalysisResult>;
  onGeneratePractice: (unitIndex: number) => Promise<void>;
  practiceLoading: number | null;
};

function EmptyCard({ message, onGenerate, loading, hasApiKey }: { message: string; onGenerate?: () => void; loading?: boolean; hasApiKey: boolean }) {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-center">
      <div className="text-3xl">✨</div>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      {onGenerate && (
        <button
          type="button"
          disabled={loading}
          onClick={onGenerate}
          className="mt-4 rounded-2xl bg-gradient-to-r from-warm to-coral px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'DeepSeek 生成中…' : '✨ 生成详细学习卡'}
        </button>
      )}
      {!hasApiKey && (
        <p className="mt-3 text-xs text-slate-400">提示：生成详细学习卡需要在「教材中心 → DeepSeek 配置」填写 API Key。</p>
      )}
    </div>
  );
}

function AnalysisView({ result }: { result: AnalysisResult }) {
  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-sky/10 p-3.5 text-sm">
      <p className="text-slate-700">{result.summary}</p>
      {!!result.grammarPoints?.length && (
        <div>
          <p className="text-xs font-semibold text-slate-500">语法亮点</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
            {result.grammarPoints.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}
      {!!result.commonMistakes?.length && (
        <div>
          <p className="text-xs font-semibold text-slate-500">常见错误</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-700">
            {result.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ModuleDetailPage(props: ModuleDetailPageProps) {
  const {
    unit, unitIndex, lessonIndex, level, hasApiKey,
    progress, onToggleProgress, onClose, onGoNext,
    onOpenUnitInPdf, onGoLearn, onAddUnitWords, wordBook, onAddWordbookItem,
    onGenerateUnitModule, unitModuleLoading, onAnalyzeSentence,
    onGeneratePractice, practiceLoading,
  } = props;
  const lesson = LESSONS[lessonIndex];
  const done = !!progress[`${unitIndex}:${lessonIndex}`];
  const [notice, setNotice] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState(1);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<number, AnalysisResult>>({});
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const [knownSet, setKnownSet] = useState<Set<number>>(new Set());

  const cardReady = !!(
    unit.vocabGroups?.length ||
    unit.grammarTopics?.length ||
    unit.commonMistakes?.length ||
    unit.exampleSentences?.length ||
    unit.keySentences?.length ||
    unit.writingSentences?.length
  );

  // 需要学习卡的模块：进入页面时若尚未生成（或旧版卡片缺长难句/写作句）则自动重新生成
  useEffect(() => {
    if (lesson?.needsCard && (!cardReady || (unit.cardVersion ?? 0) < 2) && unitModuleLoading !== unitIndex) {
      void onGenerateUnitModule(unitIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonIndex]);

  const runAnalysis = async (index: number, sentence: string) => {
    setAnalyzing(index);
    try {
      const result = await onAnalyzeSentence(sentence);
      setAnalysisResults(prev => ({ ...prev, [index]: result }));
    } finally {
      setAnalyzing(null);
    }
  };

  const markDone = () => onToggleProgress(unitIndex, lessonIndex);
  const nextLesson = LESSONS[lessonIndex + 1];

  const renderBody = () => {
    switch (lesson?.key) {
      case 'reading': {
        const sentences = unit.sentences?.length ? unit.sentences : [];
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => speakFrench(sentences.join(' '), speechRate)}
                className="rounded-2xl bg-sky/30 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-sky/50"
              >
                ▶ 整段朗读
              </button>
              <button type="button" onClick={stopSpeaking} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">⏹ 停止</button>
              <button
                type="button"
                onClick={() => { onClose(); onOpenUnitInPdf(unitIndex); }}
                className="rounded-2xl bg-lavender/40 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-lavender/70"
              >
                📖 在教材原页查看
              </button>
            </div>
            {sentences.length === 0 ? (
              <EmptyCard message="本单元暂未提取到课文句子，可先到「教材中心」重新解析教材。" hasApiKey={hasApiKey} />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                {sentences.map((s, i) => (
                  <p key={i} className="border-b border-slate-100 py-2.5 text-base leading-8 text-slate-800 last:border-0">
                    {s}
                    <button
                      type="button"
                      onClick={() => speakFrench(s, speechRate)}
                      className="ml-2 rounded-lg bg-slate-100 px-2 py-0.5 text-xs hover:bg-sky/40"
                      title="朗读此句"
                    >
                      🔊
                    </button>
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'pattern': {
        const keySentences = unit.keySentences ?? [];
        const writingSentences = unit.writingSentences ?? [];
        const candidates = (unit.exampleSentences?.map(s => s.fr) ?? []).slice(0, 4);
        const coreSentences = candidates.length ? candidates : (unit.sentences?.slice(0, 4) ?? []);
        const analyzeIdx = (i: number, sentence: string) => (
          <>
            <button
              type="button"
              disabled={analyzing === i}
              onClick={() => void runAnalysis(i, sentence)}
              className="mt-2 rounded-xl bg-lavender/40 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-lavender/70 disabled:opacity-50"
            >
              {analyzing === i ? '⏳ 分析中…' : '🧩 分析此句'}
            </button>
            {analysisResults[i] && <AnalysisView result={analysisResults[i]} />}
          </>
        );
        return (
          <div className="space-y-5">
            <p className="text-sm text-slate-500">本单元句型精析：先看「重点长难句」与「写作积累句」，可逐句用 DeepSeek 拆解结构；下方可再分析任意核心句子。</p>

            {keySentences.length > 0 && (
              <section>
                <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">🧗 重点长难句</h4>
                <div className="mt-3 space-y-3">
                  {keySentences.map((k, i) => (
                    <div key={`k-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-base font-medium leading-7 text-slate-900">{k.fr}</p>
                      <p className="mt-1 text-sm text-slate-500">{k.zh}</p>
                      {k.analysis && (
                        <p className="mt-2 rounded-2xl bg-cream p-2.5 text-xs leading-6 text-slate-600">🧩 {k.analysis}</p>
                      )}
                      {analyzeIdx(1000 + i, k.fr)}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {writingSentences.length > 0 && (
              <section>
                <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">✍️ 写作积累句</h4>
                <div className="mt-3 space-y-2">
                  {writingSentences.map((w, i) => (
                    <div key={`w-${i}`} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                      <p className="font-medium leading-7 text-slate-900">{w.fr}</p>
                      <p className="mt-0.5 text-slate-500">{w.zh}</p>
                      {w.usage && <p className="mt-1.5 text-xs text-coral">💡 {w.usage}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h4 className="flex items-center gap-2 text-base font-semibold text-slate-900">🔍 核心句子分析</h4>
              <div className="mt-3 space-y-3">
                {coreSentences.length === 0 ? (
                  <EmptyCard message="本单元暂无可分析的句子。" hasApiKey={hasApiKey} />
                ) : (
                  coreSentences.map((s, i) => (
                    <div key={`c-${i}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-base leading-7 text-slate-800">{s}</p>
                      {analyzeIdx(2000 + i, s)}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        );
      }

      case 'vocab': {
        const groups = unit.vocabGroups ?? [];
        const inBook = (word: string) => wordBook.some(w => w.text.toLowerCase() === word.toLowerCase());
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">本单元分类核心词汇（来自详细学习卡），加入生词本后可到「通用学习」用闪卡复习。</p>
              <button
                type="button"
                onClick={() => {
                  const added = onAddUnitWords(unitIndex);
                  setNotice(added > 0 ? `✅ 已将 ${added} 个核心词汇加入生词本。` : '📚 本单元词汇已在生词本中，无需重复添加。');
                }}
                className="rounded-2xl bg-gradient-to-r from-warm to-coral px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                ➕ 全部加入生词本
              </button>
            </div>
            {groups.length === 0 ? (
              <EmptyCard message="本单元暂无分类核心词汇，点击生成详细学习卡（需 DeepSeek API Key）。" onGenerate={() => void onGenerateUnitModule(unitIndex)} loading={unitModuleLoading === unitIndex} hasApiKey={hasApiKey} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {groups.map((group, gi) => (
                  <div key={gi} className="rounded-3xl border border-slate-200 bg-cream p-4">
                    <p className="text-sm font-bold text-coral">{group.category}</p>
                    <ul className="mt-2 space-y-2">
                      {group.items.map((item, ii) => (
                        <li key={ii} className="flex items-start justify-between gap-2 text-sm leading-6 text-slate-700">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900">{item.word}</span>
                            <span className="text-slate-400"> — </span>
                            <span>{item.translation}</span>
                            {item.example && <p className="mt-0.5 text-xs italic text-slate-500">例：{item.example}</p>}
                          </div>
                          {inBook(item.word) ? (
                            <span className="mt-0.5 shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">✓ 已收</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAddWordbookItem(item.word, item.translation)}
                              className="mt-0.5 shrink-0 rounded-full bg-coral/90 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-coral"
                            >
                              ➕ 收藏
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'grammar': {
        const topics = unit.grammarTopics ?? [];
        return (
          <div className="space-y-4">
            {topics.length === 0 ? (
              <EmptyCard message="本单元暂无语法精华，点击生成详细学习卡（需 DeepSeek API Key）。" onGenerate={() => void onGenerateUnitModule(unitIndex)} loading={unitModuleLoading === unitIndex} hasApiKey={hasApiKey} />
            ) : (
              topics.map((topic, ti) => (
                <div key={ti} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-bold text-slate-900">{topic.title}</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{topic.explanation}</p>
                  {topic.table && topic.table.length > 1 && (
                    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-lavender/60 text-slate-900">
                            {topic.table[0].map((head, hi) => <th key={hi} className="px-3 py-2 font-semibold whitespace-nowrap">{head}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {topic.table.slice(1).map((row, ri) => (
                            <tr key={ri} className="border-t border-slate-100 bg-white">
                              {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-slate-700">{cell}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        );
      }

      case 'mistakes': {
        const mistakes = unit.commonMistakes ?? [];
        return (
          <div className="space-y-4">
            {mistakes.length === 0 ? (
              <EmptyCard message="本单元暂无常见错误提醒，点击生成详细学习卡（需 DeepSeek API Key）。" onGenerate={() => void onGenerateUnitModule(unitIndex)} loading={unitModuleLoading === unitIndex} hasApiKey={hasApiKey} />
            ) : (
              mistakes.map((m, mi) => (
                <div key={mi} className="rounded-3xl border border-slate-200 bg-cream p-4 text-sm">
                  <p className="text-slate-500"><span className="font-semibold text-red-400">❌</span> {m.wrong}</p>
                  <p className="mt-1 text-slate-800"><span className="font-semibold text-emerald-500">✅</span> {m.right}</p>
                  {m.note && <p className="mt-1 text-xs text-slate-500">💡 {m.note}</p>}
                </div>
              ))
            )}
          </div>
        );
      }

      case 'examples': {
        const examples = unit.exampleSentences ?? [];
        return (
          <div className="space-y-4">
            {examples.length === 0 ? (
              <EmptyCard message="本单元暂无中法对照例句，点击生成详细学习卡（需 DeepSeek API Key）。" onGenerate={() => void onGenerateUnitModule(unitIndex)} loading={unitModuleLoading === unitIndex} hasApiKey={hasApiKey} />
            ) : (
              <div className="space-y-2">
                {examples.map((s, si) => (
                  <div key={si} className="rounded-3xl border border-slate-200 bg-white p-3.5 text-sm">
                    <p className="text-slate-500">{s.zh}</p>
                    <p className="mt-0.5 font-medium text-slate-900">
                      {s.fr}
                      <button
                        type="button"
                        onClick={() => speakFrench(s.fr, speechRate)}
                        className="ml-2 rounded-lg bg-slate-100 px-2 py-0.5 text-xs hover:bg-sky/40"
                        title="朗读此句"
                      >
                        🔊
                      </button>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'listening': {
        const sentences = unit.sentences?.length ? unit.sentences : [];
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => speakFrench(sentences.join(' '), speechRate)}
                className="rounded-2xl bg-sky/30 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-sky/50"
              >
                ▶ 整段朗读
              </button>
              <button type="button" onClick={stopSpeaking} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">⏹ 停止</button>
              <select
                value={speechRate}
                onChange={e => setSpeechRate(Number(e.target.value))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none focus:border-sky"
                title="语速"
              >
                <option value={0.8}>语速 0.8×（慢）</option>
                <option value={1}>语速 1×（正常）</option>
                <option value={1.2}>语速 1.2×（稍快）</option>
              </select>
            </div>
            {sentences.length === 0 ? (
              <EmptyCard message="本单元暂未提取到课文句子，可先到「教材中心」重新解析教材。" hasApiKey={hasApiKey} />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                {sentences.map((s, i) => (
                  <p key={i} className="border-b border-slate-100 py-2.5 text-base leading-8 text-slate-800 last:border-0">
                    <button
                      type="button"
                      onClick={() => speakFrench(s, speechRate)}
                      className="mr-2 rounded-lg bg-sky/20 px-2 py-0.5 text-xs hover:bg-sky/40"
                    >
                      ▶
                    </button>
                    {s}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      }

      case 'review': {
        const words = (unit.vocabGroups?.flatMap(g => g.items) ?? []).length
          ? unit.vocabGroups!.flatMap(g => g.items)
          : (unit.vocabulary ?? []);
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">点击卡片翻面查看释义，认识的点「✓ 认识」，再练的留下。共 {words.length} 个词。</p>
              <button
                type="button"
                onClick={onGoLearn}
                className="rounded-2xl bg-lavender/40 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-lavender/70"
              >
                🃏 去闪卡页完整复习
              </button>
            </div>
            {words.length === 0 ? (
              <EmptyCard message="本单元暂无词汇，点击生成详细学习卡（需 DeepSeek API Key）。" onGenerate={() => void onGenerateUnitModule(unitIndex)} loading={unitModuleLoading === unitIndex} hasApiKey={hasApiKey} />
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {words.map((w, wi) => {
                  const word = 'text' in w ? (w as any).text : (w as any).word;
                  const translation = 'translation' in w ? (w as any).translation : '';
                  const isKnown = knownSet.has(wi);
                  const isFlipped = !!flipped[wi];
                  return (
                    <div
                      key={wi}
                      className={`cursor-pointer rounded-3xl border p-4 text-center transition ${isKnown ? 'border-emerald-300 bg-emerald-50' : isFlipped ? 'border-lavender bg-blush/20' : 'border-slate-200 bg-cream hover:shadow-md'}`}
                      onClick={() => setFlipped(prev => ({ ...prev, [wi]: !prev[wi] }))}
                    >
                      <p className="text-sm font-semibold text-slate-900">{isFlipped ? translation || '（暂无释义）' : word}</p>
                      <div className="mt-2 flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setKnownSet(prev => { const n = new Set(prev); n.add(wi); return n; }); }}
                          className="rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                        >
                          ✓ 认识
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setFlipped(prev => ({ ...prev, [wi]: true })); }}
                          className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                        >
                          再练
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case 'practice':
        return (
          <UnitPracticePage
            unit={unit}
            level={level}
            loading={practiceLoading === unitIndex}
            onGenerate={() => void onGeneratePractice(unitIndex)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#fffdf7]">
      {/* 头部 */}
      <header className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-cream"
        >
          ← 返回课程
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-coral px-2.5 py-1 text-xs font-bold text-white">{level}</span>
          <span className="text-sm font-semibold text-slate-800">
            {unit.title} · {lesson?.name}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
            第 {lessonIndex + 1}/{LESSONS.length} 模块
          </span>
          {done && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">✓ 已完成</span>}
        </div>
        {!lesson?.last && (
          <button
            type="button"
            onClick={() => onGoNext(LESSONS.length - 1)}
            className="rounded-2xl bg-gradient-to-r from-warm to-coral px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
          >
            🎯 去单元练习
          </button>
        )}
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 rounded-3xl border border-slate-200 bg-white/80 p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{lesson?.icon}</span>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{lesson?.name}</h2>
                <p className="mt-0.5 text-sm text-slate-500">{lesson?.desc}</p>
              </div>
            </div>
          </div>
          {notice && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="text-emerald-500">✕</button>
            </div>
          )}
          {renderBody()}
        </div>
      </div>

      {/* 底部操作 */}
      <footer className="z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <button
          type="button"
          onClick={markDone}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${done ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          {done ? '✓ 已完成（点击取消）' : '✓ 标记完成'}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {lesson?.last ? (
            <button
              type="button"
              onClick={markDone}
              className="rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              {done ? '🎉 本单元练习已完成' : '🎉 完成本单元练习'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onGoNext(LESSONS.length - 1)}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              >
                🎯 直接做单元练习
              </button>
              <button
                type="button"
                onClick={() => nextLesson && onGoNext(lessonIndex + 1)}
                className="rounded-2xl bg-gradient-to-r from-warm to-coral px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                下一步：{nextLesson?.name} →
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
