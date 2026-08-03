import type { UnitSection } from '../types';

type UnitStudyModuleProps = {
  unit: UnitSection;
  loading?: boolean;
  onGenerate?: () => void;
};

/** 单元详细学习卡：分类词汇 / 语法精华 / 常见错误 / 中法例句（仿 DeepSeek 复习文档模式） */
export function UnitStudyModule({ unit, loading, onGenerate }: UnitStudyModuleProps) {
  const hasContent = !!(
    unit.vocabGroups?.length ||
    unit.grammarTopics?.length ||
    unit.commonMistakes?.length ||
    unit.exampleSentences?.length
  );

  if (!hasContent) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-8 text-center">
        <div className="text-3xl">✨</div>
        <h5 className="mt-2 text-base font-semibold text-slate-800">本单元详细学习卡</h5>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          用 DeepSeek 按「分类词汇 + 语法精华 + 常见错误 + 中法例句」模式生成，比基础解析更详细。
        </p>
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
        {loading && <p className="mt-2 text-xs text-slate-400">正在整理词汇、语法、易错点与例句，约需十几秒。</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ① 分类核心词汇 */}
      {!!unit.vocabGroups?.length && (
        <section>
          <h5 className="flex items-center gap-2 text-base font-semibold text-slate-900">📚 核心词汇（分类）</h5>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {unit.vocabGroups.map((group, gi) => (
              <div key={gi} className="rounded-3xl border border-slate-200 bg-cream p-4">
                <p className="text-sm font-bold text-coral">{group.category}</p>
                <ul className="mt-2 space-y-1.5">
                  {group.items.map((item, ii) => (
                    <li key={ii} className="text-sm leading-6 text-slate-700">
                      <span className="font-semibold text-slate-900">{item.word}</span>
                      <span className="text-slate-400"> — </span>
                      <span>{item.translation}</span>
                      {item.example && (
                        <p className="mt-0.5 text-xs italic text-slate-500">例：{item.example}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ② 语法精华 */}
      {!!unit.grammarTopics?.length && (
        <section>
          <h5 className="flex items-center gap-2 text-base font-semibold text-slate-900">🧩 语法精华</h5>
          <div className="mt-3 space-y-3">
            {unit.grammarTopics.map((topic, ti) => (
              <div key={ti} className="rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">{topic.title}</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-700">{topic.explanation}</p>
                {topic.table && topic.table.length > 1 && (
                  <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-lavender/60 text-slate-900">
                          {topic.table[0].map((head, hi) => (
                            <th key={hi} className="px-3 py-2 font-semibold whitespace-nowrap">{head}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topic.table.slice(1).map((row, ri) => (
                          <tr key={ri} className="border-t border-slate-100 bg-white">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 text-slate-700">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ③ 常见错误 */}
      {!!unit.commonMistakes?.length && (
        <section>
          <h5 className="flex items-center gap-2 text-base font-semibold text-slate-900">⚠️ 常见错误提醒</h5>
          <div className="mt-3 space-y-2">
            {unit.commonMistakes.map((m, mi) => (
              <div key={mi} className="rounded-3xl border border-slate-200 bg-cream p-4 text-sm">
                <p className="text-slate-500"><span className="font-semibold text-red-400">❌</span> {m.wrong}</p>
                <p className="mt-1 text-slate-800"><span className="font-semibold text-emerald-500">✅</span> {m.right}</p>
                {m.note && <p className="mt-1 text-xs text-slate-500">💡 {m.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ④ 中法对照例句 */}
      {!!unit.exampleSentences?.length && (
        <section>
          <h5 className="flex items-center gap-2 text-base font-semibold text-slate-900">💬 实用例句（中法对照）</h5>
          <div className="mt-3 space-y-2">
            {unit.exampleSentences.map((s, si) => (
              <div key={si} className="rounded-3xl border border-slate-200 bg-white p-3 text-sm">
                <p className="text-slate-500">{s.zh}</p>
                <p className="mt-0.5 font-medium text-slate-900">{s.fr}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
