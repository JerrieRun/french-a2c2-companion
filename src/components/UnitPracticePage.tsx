import { useState } from 'react';
import type { ReactNode } from 'react';
import type { PracticeItem, UnitSection } from '../types';
import { speakFrench, stopSpeaking } from '../lib/tts';

type UnitPracticePageProps = {
  unit: UnitSection;
  level: string;
  loading: boolean;
  onGenerate: () => void;
};

const SECTION_META: { key: string; icon: string; title: string; exam: string }[] = [
  { key: 'listening', icon: '🎧', title: '听力理解', exam: 'Compréhension orale' },
  { key: 'reading', icon: '📖', title: '阅读理解', exam: 'Compréhension écrite' },
  { key: 'grammar', icon: '✍️', title: '语法与结构', exam: 'Grammaire' },
  { key: 'cloze', icon: '📝', title: '完形填空', exam: 'Texte à trous' },
  { key: 'vocabulary', icon: '🔤', title: '词汇与表达', exam: 'Lexique' },
  { key: 'ordering', icon: '🧩', title: '句子重组', exam: 'Ordre des phrases' },
  { key: 'correction', icon: '⚠️', title: '改错', exam: 'Correction' },
  { key: 'writing', icon: '✍️', title: '书面表达 · 写作复述', exam: 'Production écrite' },
  { key: 'oral', icon: '🗣️', title: '口语表达 · 复述', exam: 'Production orale' },
];

function AnswerRow({ item, id }: { item: PracticeItem; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <p className="text-sm leading-6 text-slate-800">{item.question}</p>
      {!!item.options?.length && (
        <ul className="mt-2 space-y-1">
          {item.options.map((opt, i) => (
            <li key={i} className="text-sm text-slate-600">{opt}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`mt-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
      >
        {open ? '🙈 收起答案' : '💡 显示答案'}
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-sm">
          <p className="font-semibold text-emerald-700">✅ {item.answer}</p>
          {item.explain && <p className="mt-1 text-xs leading-5 text-slate-600">{item.explain}</p>}
        </div>
      )}
    </div>
  );
}

function OrderingCard({ sentences, answer, explain }: { sentences: string[]; answer: string; explain?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <p className="text-xs font-medium text-slate-500">把下列句子按正确顺序排成一段话（写出序号顺序）：</p>
      <ol className="mt-2 space-y-1">
        {sentences.map((s, si) => (
          <li key={si} className="text-sm leading-6 text-slate-700">
            <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">{si + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`mt-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
      >
        {open ? '🙈 收起答案' : '💡 显示答案'}
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-sm">
          <p className="font-semibold text-emerald-700">✅ 正确顺序：{answer}</p>
          {explain && <p className="mt-1 text-xs leading-5 text-slate-600">{explain}</p>}
        </div>
      )}
    </div>
  );
}

function SectionShell({ icon, title, exam, children }: { icon: string; title: string; exam: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-cream/60 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h5 className="text-base font-semibold text-slate-900">{title}</h5>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-500">{exam}</span>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function UnitPracticePage({ unit, level, loading, onGenerate }: UnitPracticePageProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showModel, setShowModel] = useState<Record<string, boolean>>({});
  const p = unit.practiceSections;

  if (!p) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-center">
        <div className="text-4xl">🎯</div>
        <h5 className="mt-2 text-lg font-semibold text-slate-800">单元练习（覆盖考级全部题型）</h5>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
          用 DeepSeek 按法语考级（{level} 级 DELF / DALF / TCF）题型生成：听力、阅读、语法、完形、
          词汇、句子重组、改错、<strong>书面表达·写作复述</strong>、<strong>口语复述</strong>，一套练完整个单元。
        </p>
        {onGenerate && (
          <button
            type="button"
            disabled={loading}
            onClick={onGenerate}
            className="mt-5 rounded-2xl bg-gradient-to-r from-warm to-coral px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
          >
            {loading ? '⏳ DeepSeek 生成全题型练习中…' : '✨ 生成本单元全题型练习'}
          </button>
        )}
        {loading && <p className="mt-2 text-xs text-slate-400">正在按考纲生成 9 类题型，约需 20-40 秒。</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white/80 p-3">
        <p className="text-xs text-slate-500">已按 {level} 级考纲生成：9 类题型，逐题可看答案与解析。</p>
        <button
          type="button"
          disabled={loading}
          onClick={onGenerate}
          className="rounded-2xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-40"
        >
          {loading ? '重新生成中…' : '🔄 重新生成'}
        </button>
      </div>

      {p.listening && (
        <SectionShell icon="🎧" title="听力理解" exam="Compréhension orale">
          {p.listening.instructions && <p className="text-sm text-slate-600">📌 {p.listening.instructions}</p>}
          {p.listening.transcript && (
            <div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => speakFrench(p.listening!.transcript || '')}
                  className="rounded-xl bg-sky/30 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-sky/50"
                >
                  ▶ 播放听力文本
                </button>
                <button
                  type="button"
                  onClick={() => setShowTranscript(s => !s)}
                  className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  {showTranscript ? '收起文本' : '查看听力文本'}
                </button>
                <button type="button" onClick={stopSpeaking} className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200">⏹</button>
              </div>
              {showTranscript && (
                <p className="mt-2 rounded-2xl bg-white p-3 text-sm leading-6 text-slate-700">{p.listening.transcript}</p>
              )}
            </div>
          )}
          {p.listening.items.map((item, i) => <AnswerRow key={i} item={item} id={`listening-${i}`} />)}
        </SectionShell>
      )}

      {p.reading && (
        <SectionShell icon="📖" title="阅读理解" exam="Compréhension écrite">
          {p.reading.passage && (
            <p className="whitespace-pre-wrap rounded-2xl bg-white p-3.5 text-sm leading-6 text-slate-700">{p.reading.passage}</p>
          )}
          {p.reading.items.map((item, i) => <AnswerRow key={i} item={item} id={`reading-${i}`} />)}
        </SectionShell>
      )}

      {p.grammar && (
        <SectionShell icon="✍️" title="语法与结构" exam="Grammaire">
          {p.grammar.items.map((item, i) => <AnswerRow key={i} item={item} id={`grammar-${i}`} />)}
        </SectionShell>
      )}

      {p.cloze && (
        <SectionShell icon="📝" title="完形填空" exam="Texte à trous">
          {p.cloze.title && <p className="text-sm font-medium text-slate-700">{p.cloze.title}</p>}
          {p.cloze.text && <p className="whitespace-pre-wrap rounded-2xl bg-white p-3.5 text-sm leading-6 text-slate-700">{p.cloze.text}</p>}
          {p.cloze.items.map((item, i) => <AnswerRow key={i} item={item} id={`cloze-${i}`} />)}
        </SectionShell>
      )}

      {p.vocabulary && (
        <SectionShell icon="🔤" title="词汇与表达" exam="Lexique">
          {p.vocabulary.items.map((item, i) => <AnswerRow key={i} item={item} id={`vocab-${i}`} />)}
        </SectionShell>
      )}

      {p.ordering && (
        <SectionShell icon="🧩" title="句子重组" exam="Ordre des phrases">
          {p.ordering.items.map((item, i) => (
            <OrderingCard key={i} sentences={item.sentences} answer={item.answer} explain={item.explain} />
          ))}
        </SectionShell>
      )}

      {p.correction && (
        <SectionShell icon="⚠️" title="改错" exam="Correction">
          {p.correction.items.map((item, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-3.5 text-sm">
              <p className="text-slate-500"><span className="font-semibold text-red-400">❌</span> {item.wrong}</p>
              <p className="mt-1 text-slate-800"><span className="font-semibold text-emerald-500">✅</span> {item.right}</p>
              {item.note && <p className="mt-1 text-xs text-slate-500">💡 {item.note}</p>}
            </div>
          ))}
        </SectionShell>
      )}

      {p.writing && (
        <SectionShell icon="✍️" title="书面表达 · 写作复述" exam="Production écrite">
          <p className="whitespace-pre-wrap rounded-2xl bg-white p-3.5 text-sm leading-6 text-slate-800">{p.writing.prompt}</p>
          {!!p.writing.tips?.length && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              {p.writing.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
          {p.writing.modelAnswer && (
            <div>
              <button
                type="button"
                onClick={() => setShowModel(s => ({ ...s, writing: !s.writing }))}
                className="rounded-xl bg-lavender/40 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-lavender/70"
              >
                {showModel.writing ? '🙈 收起范文' : '📄 查看参考范文'}
              </button>
              {showModel.writing && (
                <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-white p-3.5 text-sm leading-6 text-slate-700">{p.writing.modelAnswer}</p>
              )}
            </div>
          )}
        </SectionShell>
      )}

      {p.oral && (
        <SectionShell icon="🗣️" title="口语表达 · 复述" exam="Production orale">
          <p className="whitespace-pre-wrap rounded-2xl bg-white p-3.5 text-sm leading-6 text-slate-800">{p.oral.prompt}</p>
          {!!p.oral.points?.length && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              {p.oral.points.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
          {p.oral.modelAnswer && (
            <div>
              <button
                type="button"
                onClick={() => setShowModel(s => ({ ...s, oral: !s.oral }))}
                className="rounded-xl bg-lavender/40 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-lavender/70"
              >
                {showModel.oral ? '🙈 收起参考表达' : '💬 查看参考表达'}
              </button>
              {showModel.oral && (
                <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-white p-3.5 text-sm leading-6 text-slate-700">{p.oral.modelAnswer}</p>
              )}
            </div>
          )}
        </SectionShell>
      )}
    </div>
  );
}
