import { useMemo, useState } from 'react';
import type { AnalysisResult, MaterialPreview, PathProgress, WordCandidate } from '../types';
import { UnitStudyModule } from '../components/UnitStudyModule';
import { ModuleDetailPage } from '../components/ModuleDetailPage';
import { LESSONS } from '../lib/lessons';
import { detectLevel } from '../lib/unitPractice';

const LEVELS = ['A2', 'B1', 'B2', 'C1', 'C2'];

type PathTabProps = {
  materialPreview: MaterialPreview | null;
  pdfName: string | null;
  hasApiKey: boolean;
  onOpenUnitInPdf: (unitIndex: number) => void;
  onAddUnitWords: (unitIndex: number) => number;
  wordBook: WordCandidate[];
  onAddWordbookItem: (text: string, translation: string, cefr?: string) => void;
  onGoMaterials: () => void;
  onGoLearn: () => void;
  onGenerateUnitModule: (unitIndex: number) => Promise<void>;
  unitModuleLoading: number | null;
  onAnalyzeSentence: (sentence: string) => Promise<AnalysisResult>;
  onGeneratePractice: (unitIndex: number) => Promise<void>;
  practiceLoading: number | null;
  progress: PathProgress;
  onToggleProgress: (unit: number, lesson: number) => void;
};

function cleanTitle(name: string | null): string {
  if (!name) return '我的教材';
  return name.replace(/\.pdf$/i, '').trim() || '我的教材';
}

export function PathTab({
  materialPreview,
  pdfName,
  hasApiKey,
  onOpenUnitInPdf,
  onAddUnitWords,
  wordBook,
  onAddWordbookItem,
  onGoMaterials,
  onGoLearn,
  onGenerateUnitModule,
  unitModuleLoading,
  onAnalyzeSentence,
  onGeneratePractice,
  practiceLoading,
  progress,
  onToggleProgress,
}: PathTabProps) {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [expandedModule, setExpandedModule] = useState<number | null>(null);
  const [openModule, setOpenModule] = useState<{ unit: number; lesson: number } | null>(null);
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

  /* ---------- 课程列表视图 ---------- */
  if (view === 'list') {
    return (
      <div className="space-y-6">
        <div className="rounded-[28px] bg-gradient-to-r from-warm to-coral p-6 text-white shadow-sm">
          <h3 className="text-xl font-semibold">🗺️ 法语分级学习路径</h3>
          <p className="mt-2 max-w-2xl text-sm text-white/90">
            按 CEFR 等级组织课程 → 单元 → 模块。每个单元 9 个模块：精读、句型、词汇、语法、常见错误、
            例句、跟读、闪卡复习，内容来自 DeepSeek 生成的详细学习卡；最后是覆盖考级全部题型的「单元练习」。
            点击模块在独立页面学习，学完即可进入对应练习。
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
                <p><span className="font-bold text-slate-900">模块 {lessonDone}/{lessonTotal}</span>；习题 {course.exercisesTotal} 道</p>
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
              共 {course.units.length} 个单元，每单元 {LESSONS.length} 个模块
              （{LESSONS.map(l => l.name).join(' / ')}）。点击任一模块在独立页面学习，学完可直接进入「单元练习」。
            </p>
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-sm">
            <div className="text-4xl">📭</div>
            <h4 className="mt-3 text-lg font-semibold text-slate-800">还没有可学习的课程</h4>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              先到「教材中心」上传并解析一本法语教材（推荐 Édito / Alter Ego 等分单元教材），
              系统会自动按 CEFR 等级生成课程与模块。
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
          模块 {lessonDone}/{lessonTotal} 已完成 · 习题 {course.exercisesTotal} 道 · 共 {course.units.length} 个单元
        </p>
        <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: lessonTotal ? `${Math.round((lessonDone / lessonTotal) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {course.units.map((unit, uIdx) => (
        <div key={uIdx} className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">
                Unité {uIdx}: {unit.title}
              </h4>
              <p className="mt-0.5 text-xs text-slate-500">点击下方模块即可在独立页面学习 · 学完进入「单元练习」</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = expandedModule === uIdx ? null : uIdx;
                setExpandedModule(next);
                if (next !== null && !unit.vocabGroups && !unit.grammarTopics && !unit.exampleSentences && unitModuleLoading !== uIdx) {
                  void onGenerateUnitModule(uIdx);
                }
              }}
              className={`rounded-2xl px-3.5 py-2 text-xs font-semibold transition ${
                expandedModule === uIdx ? 'bg-coral text-white' : 'bg-lavender/50 text-slate-700 hover:bg-lavender'
              }`}
            >
              {expandedModule === uIdx ? '收起学习卡 ▲' : '📖 详细学习卡'}
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-500">{unit.summary || unit.excerpt?.slice(0, 80) || '本单元学习内容'}</p>
          {expandedModule === uIdx && (
            <div className="mt-4 rounded-[28px] border border-slate-200 bg-white/80 p-5">
              <UnitStudyModule
                unit={unit}
                loading={unitModuleLoading === uIdx}
                onGenerate={() => void onGenerateUnitModule(uIdx)}
              />
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {LESSONS.map((lesson, lIdx) => {
              const done = !!progress[`${uIdx}:${lIdx}`];
              return (
                <button
                  key={lesson.key}
                  type="button"
                  onClick={() => setOpenModule({ unit: uIdx, lesson: lIdx })}
                  className={`relative rounded-3xl border p-4 text-left transition ${
                    done ? 'border-emerald-300 bg-emerald-50 hover:shadow-md' : 'border-slate-200 bg-cream hover:shadow-md'
                  }`}
                >
                  <div className="text-2xl">{lesson.icon}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">{lesson.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {lesson.last ? '🎯 最后模块 · 全部题型' : `第 ${lIdx + 1} 模块`}
                  </div>
                  {done && <span className="absolute right-3 top-3 text-emerald-500">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* 模块详情：全屏新页面 */}
      {openModule && (
        <ModuleDetailPage
          unit={course.units[openModule.unit]}
          unitIndex={openModule.unit}
          lessonIndex={openModule.lesson}
          level={course.level}
          hasApiKey={hasApiKey}
          progress={progress}
          onToggleProgress={onToggleProgress}
          onClose={() => setOpenModule(null)}
          onGoNext={lesson => setOpenModule({ unit: openModule.unit, lesson })}
          onOpenUnitInPdf={onOpenUnitInPdf}
          onGoLearn={onGoLearn}
          onAddUnitWords={onAddUnitWords}
          wordBook={wordBook}
          onAddWordbookItem={onAddWordbookItem}
          onGenerateUnitModule={onGenerateUnitModule}
          unitModuleLoading={unitModuleLoading}
          onAnalyzeSentence={onAnalyzeSentence}
          onGeneratePractice={onGeneratePractice}
          practiceLoading={practiceLoading}
        />
      )}
    </div>
  );
}
