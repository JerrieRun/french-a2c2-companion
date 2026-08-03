import { useEffect, useMemo, useState } from 'react';
import type { MaterialPreview, PathProgress } from '../types';

const STORAGE_KEY = 'french-path-progress';

/** 每个单元固定 4 个课时，模拟 Luke Academy 的课时粒度 */
const LESSONS = [
  { key: 'reading', icon: '📖', name: '课文精读', desc: '回到教材原文精读本单元：可划线翻译、解析句型、点词看详解、收藏生词。' },
  { key: 'vocab', icon: '📚', name: '核心词汇', desc: '把本单元核心词汇一键加入生词本，之后到「通用学习」用闪卡复习。' },
  { key: 'listening', icon: '🗣️', name: '朗读跟读', desc: '到「通用学习」用浏览器语音跟读本单元课文，训练语音语调。' },
  { key: 'grammar', icon: '✍️', name: '语法要点', desc: '针对本单元主题生成语法练习题，先作答再对答案。' },
];

const LEVELS = ['A2', 'B1', 'B2', 'C1', 'C2'];

type PathTabProps = {
  materialPreview: MaterialPreview | null;
  pdfName: string | null;
  onOpenUnitInPdf: (unitIndex: number) => void;
  onStartGrammar: (level: string, topic: string) => void;
  onAddUnitWords: (unitIndex: number) => number;
  onGoMaterials: () => void;
  onGoLearn: () => void;
};

/** 从教材文件名推断 CEFR 等级，缺省 B2 */
function detectLevel(name: string | null): string {
  const m = (name || '').match(/\b(A2|B1|B2|C1|C2)\b/i);
  return m ? m[1].toUpperCase() : 'B2';
}

function cleanTitle(name: string | null): string {
  if (!name) return '我的教材';
  return name.replace(/\.pdf$/i, '').trim() || '我的教材';
}

export function PathTab({
  materialPreview,
  pdfName,
  onOpenUnitInPdf,
  onStartGrammar,
  onAddUnitWords,
  onGoMaterials,
  onGoLearn,
}: PathTabProps) {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [dialog, setDialog] = useState<{ unit: number; lesson: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<PathProgress>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as PathProgress;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const course = useMemo(() => {
    if (!materialPreview || materialPreview.units.length === 0) return null;
    const level = detectLevel(pdfName);
    const exercisesTotal =
      materialPreview.units.reduce((sum, u) => sum + (u.practice?.length || 0), 0) ||
      materialPreview.units.reduce((sum, u) => sum + (u.sentences?.length || 0), 0);
    return {
      id: 'textbook',
      level,
      title: cleanTitle(pdfName),
      subtitle: '综合 · 教材精读',
      units: materialPreview.units,
      exercisesTotal,
    };
  }, [materialPreview, pdfName]);

  const lessonTotal = course ? course.units.length * LESSONS.length : 0;
  const lessonDone = Object.values(progress).filter(Boolean).length;

  /** 解锁规则：第 1 个课时可学；完成一课解锁下一课；完成上一单元末课解锁下一单元 */
  const isUnlocked = (unit: number, lesson: number): boolean => {
    if (!course) return false;
    if (unit === 0 && lesson === 0) return true;
    if (lesson > 0) return !!progress[`${unit}:${lesson - 1}`];
    return !!progress[`${unit - 1}:${LESSONS.length - 1}`];
  };

  const toggleDone = (unit: number, lesson: number) => {
    setProgress(prev => {
      const next = { ...prev };
      const key = `${unit}:${lesson}`;
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const startLesson = (unit: number, lesson: number) => {
    const u = course?.units[unit];
    const kind = LESSONS[lesson];
    if (!u || !kind) return;
    setDialog(null);
    switch (kind.key) {
      case 'reading':
        onOpenUnitInPdf(unit);
        break;
      case 'vocab': {
        const added = onAddUnitWords(unit);
        setNotice(added > 0 ? `✅ 已将 ${added} 个核心词汇加入生词本，可到「通用学习」用闪卡复习。` : '📚 本单元词汇已在生词本中，无需重复添加。');
        break;
      }
      case 'listening':
        onGoLearn();
        break;
      case 'grammar':
        onStartGrammar(course?.level || 'B2', u.title);
        break;
    }
  };

  /* ---------- 课程列表视图 ---------- */
  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* 顶部：路线总览 */}
        <div className="rounded-[28px] bg-gradient-to-r from-warm to-coral p-6 text-white shadow-sm">
          <h3 className="text-xl font-semibold">🗺️ 法语分级学习路径</h3>
          <p className="mt-2 max-w-2xl text-sm text-white/90">
            参考 Luke Academy 的课程体系：按 CEFR 等级组织课程 → 单元 → 课时，一课一练，完成当前课时解锁下一课时。
            上传教材并解析后，系统会自动为对应等级生成一门课程。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {LEVELS.map((lv, i) => {
              const active = course?.level === lv;
              return (
                <div key={lv} className="flex items-center gap-2">
                  <span
                    className={`rounded-2xl px-4 py-2 text-sm font-bold ${
                      active ? 'bg-white text-coral shadow' : 'bg-white/20 text-white/90'
                    }`}
                  >
                    {lv}{active ? ' ✓' : ''}
                  </span>
                  {i < LEVELS.length - 1 && <span className="text-white/60">→</span>}
                </div>
              );
            })}
          </div>
        </div>

        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-[28px] border border-slate-200 bg-white/90 px-5 py-4 text-sm text-slate-700 shadow-sm">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
        )}

        {/* 课程卡 */}
        {course ? (
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lavender text-2xl font-bold text-slate-900">🇫🇷</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xl bg-coral px-2.5 py-1 text-xs font-bold text-white">{course.level}</span>
                    <span className="rounded-xl bg-cream px-2.5 py-1 text-xs font-semibold text-slate-600">{course.subtitle}</span>
                  </div>
                  <h4 className="mt-1.5 text-lg font-semibold text-slate-900">{course.title}</h4>
                </div>
              </div>
              <div className="text-right text-sm text-slate-600">
                <p><span className="font-bold text-slate-900">课时 {lessonDone}/{lessonTotal}</span>；习题 0/{course.exercisesTotal}</p>
                <button
                  type="button"
                  onClick={() => setView('detail')}
                  className="mt-2 rounded-2xl bg-gradient-to-r from-warm to-coral px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                >
                  学习该部分 →
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              共 {course.units.length} 个单元，每单元 4 个课时（精读 / 词汇 / 跟读 / 语法）。完成一课，解锁下一课。
            </p>
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-sm">
            <div className="text-4xl">📭</div>
            <h4 className="mt-3 text-lg font-semibold text-slate-800">还没有可学习的课程</h4>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              先到「教材中心」上传并解析一本法语教材（推荐 Édito / Alter Ego 等分单元教材），
              系统会自动按 CEFR 等级生成课程与课时。
            </p>
            <button
              type="button"
              onClick={onGoMaterials}
              className="mt-4 rounded-2xl bg-gradient-to-r from-warm to-coral px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              去教材中心上传
            </button>
          </div>
        )}

        {/* 其他等级（未上传教材 = 开发中，对齐 Luke Academy 的“开发中”卡片） */}
        <div className="grid gap-4 md:grid-cols-2">
          {LEVELS.filter(lv => lv !== course?.level).map(lv => (
            <div key={lv} className="rounded-[28px] border border-slate-200 bg-white/70 p-5 opacity-80">
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600">{lv}</span>
                <span className="text-xs text-slate-400">开发中</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-700">{lv} 阶段课程</p>
              <p className="mt-1 text-xs text-slate-500">上传该等级的教材并解析后自动启用。</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- 课程详情视图 ---------- */
  if (!course) return null;
  const dlg = dialog ? { unit: course.units[dialog.unit], uIdx: dialog.unit, lesson: LESSONS[dialog.lesson], lIdx: dialog.lesson } : null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setView('list')}
        className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-cream"
      >
        ← 课程列表
      </button>

      <div className="rounded-[28px] bg-gradient-to-r from-warm to-coral p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-white/25 px-2.5 py-1 text-xs font-bold">{course.level}</span>
          <span className="rounded-xl bg-white/25 px-2.5 py-1 text-xs font-semibold">{course.subtitle}</span>
        </div>
        <h3 className="mt-2 text-xl font-semibold">{course.title}</h3>
        <p className="mt-1 text-sm text-white/90">
          课时 {lessonDone}/{lessonTotal} 已完成 · 习题 {course.exercisesTotal} 道 · 共 {course.units.length} 个单元
        </p>
        <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: lessonTotal ? `${Math.round((lessonDone / lessonTotal) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-[28px] border border-slate-200 bg-white/90 px-5 py-4 text-sm text-slate-700 shadow-sm">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {course.units.map((unit, uIdx) => (
        <div key={uIdx} className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h4 className="text-lg font-semibold text-slate-900">
            Unité {uIdx}: {unit.title}
          </h4>
          <p className="mt-1 text-sm text-slate-500">{unit.summary || unit.excerpt?.slice(0, 80) || '本单元学习内容'}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {LESSONS.map((lesson, lIdx) => {
              const unlocked = isUnlocked(uIdx, lIdx);
              const done = !!progress[`${uIdx}:${lIdx}`];
              return (
                <button
                  key={lesson.key}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => setDialog({ unit: uIdx, lesson: lIdx })}
                  className={`relative rounded-3xl border p-4 text-left transition ${
                    done
                      ? 'border-emerald-300 bg-emerald-50'
                      : unlocked
                      ? 'border-slate-200 bg-cream hover:shadow-md'
                      : 'border-slate-200 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="text-2xl">{unlocked ? lesson.icon : '🔒'}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">{lesson.name}</div>
                  <div className="mt-1 text-xs text-slate-500">第 {lIdx + 1} 课</div>
                  {done && <span className="absolute right-3 top-3 text-emerald-500">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 课时弹窗 */}
      {dlg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setDialog(null)}>
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            {!isUnlocked(dlg.uIdx, dlg.lIdx) ? (
              <>
                <div className="text-3xl">🔒</div>
                <h4 className="mt-2 text-lg font-semibold text-slate-900">{dlg.lesson.name} · 该课未解锁</h4>
                <p className="mt-2 text-sm text-slate-600">第 {dlg.lIdx + 1} 课，本单元共 {LESSONS.length} 课。先完成上一课时，解锁后即可学习。</p>
                <div className="mt-5 flex justify-end gap-3">
                  <button type="button" onClick={() => setDialog(null)} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">
                    取消
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-3xl">{dlg.lesson.icon}</div>
                <h4 className="mt-2 text-lg font-semibold text-slate-900">
                  {dlg.unit.title} · {dlg.lesson.name}
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  第 {dlg.lIdx + 1} 课，本单元共 {LESSONS.length} 课
                </p>
                <p className="mt-3 text-sm text-slate-600">{dlg.lesson.desc}</p>
                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => toggleDone(dlg.uIdx, dlg.lIdx)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                      progress[`${dlg.uIdx}:${dlg.lIdx}`]
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {progress[`${dlg.uIdx}:${dlg.lIdx}`] ? '✓ 已完成（点击取消）' : '标记完成'}
                  </button>
                  <button type="button" onClick={() => startLesson(dlg.uIdx, dlg.lIdx)} className="rounded-2xl bg-gradient-to-r from-warm to-coral px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
                    开始学习
                  </button>
                  <button type="button" onClick={() => setDialog(null)} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200">
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
