import { useMemo, useRef, useState } from 'react';
import type { FlashcardSrs, WordCandidate } from '../types';
import type { SrsGrade } from '../lib/srs';
import { gradeSrs, isDue, intervalLabel } from '../lib/srs';
import { speakFrench, stopSpeaking } from '../lib/tts';

type Cefr = 'all' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

type SrsFlashcardDeckProps = {
  words: WordCandidate[];
  srs: Record<string, FlashcardSrs>;
  onSrsReview: (word: string, grade: SrsGrade) => void;
  onExportWordBook: () => void;
  onImportWordBook: (text: string, fileName: string) => void;
  onBackfillTranslations: () => Promise<number>;
};

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/[’']/g, "'");

export function SrsFlashcardDeck({ words, srs, onSrsReview, onExportWordBook, onImportWordBook, onBackfillTranslations }: SrsFlashcardDeckProps) {
  const [filter, setFilter] = useState<Cefr>('all');
  const [mode, setMode] = useState<'card' | 'spell'>('card');
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState<Record<SrsGrade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [wrong, setWrong] = useState<WordCandidate[]>([]);
  const [spellInput, setSpellInput] = useState('');
  const [spellChecked, setSpellChecked] = useState<boolean | null>(null);
  const [spellWrong, setSpellWrong] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const now = useMemo(() => Date.now(), []);
  const [overrideQueue, setOverrideQueue] = useState<WordCandidate[] | null>(null);
  const queue = useMemo(() => {
    if (overrideQueue) return overrideQueue;
    const fresh: WordCandidate[] = [];
    const due: WordCandidate[] = [];
    for (const w of words) {
      if (filter !== 'all' && (w.cefr || 'B2') !== filter) continue;
      const s = srs[w.text];
      if (!s) fresh.push(w);
      else if (isDue(s, now)) due.push(w);
    }
    due.sort((a, b) => (srs[a.text]?.due ?? 0) - (srs[b.text]?.due ?? 0));
    return [...shuffle(fresh), ...due];
  }, [words, srs, filter, now, overrideQueue]);

  const dueCount = useMemo(() => words.filter(w => (filter === 'all' || (w.cefr || 'B2') === filter) && isDue(srs[w.text], now)).length, [words, srs, filter, now]);
  const newCount = useMemo(() => words.filter(w => (filter === 'all' || (w.cefr || 'B2') === filter) && !srs[w.text]).length, [words, srs, filter]);

  const total = words.length;

  const [pos, setPos] = useState(0);
  const done = pos >= queue.length;
  const current = queue[Math.min(pos, queue.length - 1)];

  const grade = (g: SrsGrade) => {
    if (!current) return;
    onSrsReview(current.text, g);
    setStats(s => ({ ...s, [g]: s[g] + 1 }));
    if (g === 'again' || g === 'hard') setWrong(w => [...w, current]);
    setFlipped(false);
    setSpellInput('');
    setSpellChecked(null);
    setSpellWrong(false);
    setPos(p => p + 1);
  };

  const checkSpell = () => {
    if (!current) return;
    const ok = normalize(spellInput) === normalize(current.text);
    setSpellChecked(ok);
    setSpellWrong(!ok);
  };

  const restart = (onlyWrong: boolean) => {
    if (onlyWrong && wrong.length) setOverrideQueue([...wrong]);
    else setOverrideQueue(null);
    setWrong([]);
    setStats({ again: 0, hard: 0, good: 0, easy: 0 });
    setPos(0);
    setFlipped(false);
    setSpellInput('');
    setSpellChecked(null);
    setSpellWrong(false);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      onImportWordBook(text, file.name);
    } catch (err) {
      console.warn('导入生词本失败：', err);
    } finally {
      e.target.value = '';
    }
  };

  if (total === 0) {
    return (
      <article className="rounded-[28px] bg-cream p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">单词闪卡 🃏</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          生词本还是空的。先去「教材中心」上传教材并收藏生词，或点下方「📥 导入」导入生词本文件。
        </p>
        <button type="button" onClick={() => importRef.current?.click()} className="mt-3 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100">📥 导入生词本</button>
        <input ref={importRef} type="file" accept=".csv,.txt,.json,text/csv" className="hidden" onChange={handleImportFile} />
      </article>
    );
  }

  const srsCurrent = current ? (srs[current.text] ?? { word: current.text, translation: current.translation, cefr: current.cefr, mastery: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0 }) : null;

  return (
    <article className="rounded-[28px] bg-cream p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">单词闪卡 · 间隔重复 🃏</h3>
          <p className="mt-1 text-xs text-slate-500">今日待复习 {dueCount} · 新词 {newCount} · 共 {total} 词</p>
          {backfillMsg && <p className="mt-1 text-xs font-medium text-emerald-700">{backfillMsg}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {words.some(w => !w.translation || w.translation === '待补充') && (
            <button
              type="button"
              disabled={backfilling}
              onClick={async () => {
                setBackfilling(true);
                setBackfillMsg(null);
                const n = await onBackfillTranslations();
                setBackfillMsg(n > 0 ? `✅ 已补全 ${n} 个释义` : '没有可补全的释义（需配置 DeepSeek API Key）');
                setBackfilling(false);
              }}
              className="rounded-2xl bg-lavender/50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-lavender disabled:opacity-50"
            >
              {backfilling ? '补全中…' : '🔧 补全释义'}
            </button>
          )}
          <button type="button" onClick={onExportWordBook} className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100">⬇️ 导出</button>
          <button type="button" onClick={() => importRef.current?.click()} className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100">📥 导入</button>
          <input ref={importRef} type="file" accept=".csv,.txt,.json,text/csv" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {/* 模式 + CEFR 过滤 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-2xl bg-slate-200/70 p-1">
          <button type="button" onClick={() => setMode('card')} className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${mode === 'card' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>🃏 卡片回忆</button>
          <button type="button" onClick={() => setMode('spell')} className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${mode === 'spell' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>✏️ 拼写测验</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'A2', 'B1', 'B2', 'C1', 'C2'] as Cefr[]).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { setFilter(c); setOverrideQueue(null); setPos(0); setWrong([]); setStats({ again: 0, hard: 0, good: 0, easy: 0 }); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === c ? 'bg-coral text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              {c === 'all' ? '全部' : c}
            </button>
          ))}
        </div>
      </div>

      {done ? (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">本轮完成！</p>
          <p className="mt-2 text-sm text-slate-600">
            遗忘 {stats.again} · 模糊 {stats.hard} · 认识 {stats.good} · 简单 {stats.easy}
          </p>
          {wrong.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">有 {wrong.length} 个词还需要加强，建议重做一轮。</p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {wrong.length > 0 && (
              <button type="button" onClick={() => restart(true)} className="rounded-2xl bg-coral px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90">
                🔁 重做错误词（{wrong.length}）
              </button>
            )}
            <button type="button" onClick={() => restart(false)} className="rounded-2xl bg-gradient-to-r from-warm to-coral px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              再来一轮 🔄
            </button>
          </div>
        </div>
      ) : current && srsCurrent ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-warm to-coral transition-all" style={{ width: `${((pos + 1) / queue.length) * 100}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-500">{pos + 1} / {queue.length}</span>
          </div>

          {mode === 'card' ? (
            <div
              className="flashcard-scene mt-4 h-56 w-full cursor-pointer select-none"
              onClick={() => setFlipped(f => !f)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped(f => !f); } }}
            >
              <div className={`flashcard-inner relative h-full w-full ${flipped ? 'flipped' : ''}`}>
                <div className="flashcard-face absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">点击翻面 · 先回忆再看答案</p>
                  <p className="mt-3 text-center text-3xl font-semibold text-slate-900">{current.text}</p>
                  <button type="button" onClick={e => { e.stopPropagation(); speakFrench(current.text); }} className="mt-3 rounded-full bg-sky/20 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-sky/40">🔊 发音</button>
                </div>
                <div className="flashcard-face flashcard-back absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-coral/30 bg-white p-6 shadow-sm">
                  <p className="text-center text-2xl font-semibold text-slate-900">{current.translation}</p>
                  <p className="mt-3 rounded-full bg-sky/40 px-3 py-1 text-xs font-semibold text-slate-700">{srsCurrent.cefr}</p>
                  <p className="mt-2 text-xs text-slate-400">熟练度 {srsCurrent.mastery}/5 · 下一轮 {intervalLabel(srsCurrent.interval)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">听发音 / 看释义，拼出法语单词</p>
              <div className="mt-3 flex items-center gap-2">
                <p className="text-2xl font-semibold text-slate-900">{current.translation}</p>
                <button type="button" onClick={() => speakFrench(current.text)} className="rounded-full bg-sky/20 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-sky/40">🔊</button>
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={spellInput}
                  onChange={e => { setSpellInput(e.target.value); setSpellChecked(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') checkSpell(); }}
                  placeholder="输入法语单词…"
                  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky"
                  autoFocus
                />
                <button type="button" onClick={checkSpell} disabled={!spellInput.trim()} className="rounded-2xl bg-sky px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-40">检查</button>
              </div>
              {spellChecked !== null && (
                <p className={`mt-3 text-sm font-semibold ${spellChecked ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {spellChecked ? `✅ 正确：${current.text}` : `❌ 正确写法：${current.text}`}
                </p>
              )}
              {(spellChecked === true || spellWrong) && (
                <p className="mt-2 text-xs text-slate-400">现在评价一下你对这个词的掌握程度 ↓</p>
              )}
            </div>
          )}

          {/* 评价按钮 */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            <button type="button" onClick={() => grade('again')} className="rounded-2xl bg-rose-100 px-2 py-3 text-xs font-semibold text-rose-700 hover:bg-rose-200">😵 不认识</button>
            <button type="button" onClick={() => grade('hard')} className="rounded-2xl bg-amber-100 px-2 py-3 text-xs font-semibold text-amber-700 hover:bg-amber-200">🤔 模糊</button>
            <button type="button" onClick={() => grade('good')} className="rounded-2xl bg-emerald-100 px-2 py-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">🙂 认识</button>
            <button type="button" onClick={() => grade('easy')} className="rounded-2xl bg-sky/30 px-2 py-3 text-xs font-semibold text-slate-700 hover:bg-sky/50">😎 简单</button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>本轮：遗忘 {stats.again} · 模糊 {stats.hard} · 认识 {stats.good} · 简单 {stats.easy}</span>
            <button type="button" onClick={stopSpeaking} className="hover:text-slate-600">⏹ 停止朗读</button>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {filter === 'all' ? '今日没有到期的新词或复习词，去学新词或休息吧 🎉' : `当前 CEFR 等级（${filter}）没有待学习的词。`}
        </div>
      )}
    </article>
  );
}
