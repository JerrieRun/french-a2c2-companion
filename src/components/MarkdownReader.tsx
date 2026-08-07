import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractMarkdownRange, splitMarkdownPages } from '../lib/pdfToMarkdown';

type Selection = { text: string; x: number; y: number };

type MarkdownReaderProps = {
  markdown: string;
  fileName: string;
  sourceLabel: string;
  units: { title: string; startPage?: number; endPage?: number }[];
  onJumpToPdfPage: (page: number) => void;
  onIntensiveAnalyze: (text: string) => Promise<void>;
  onLookupWord: (word: string, context?: string) => Promise<void> | void;
  onAddWord: (text: string) => void;
  onImportMarkdown: (text: string, name?: string) => Promise<void>;
};

/** 从 localStorage 读取阅读偏好 */
const readPref = (key: string, fallback: number | string) => {
  try {
    const v = window.localStorage.getItem(key);
    if (v == null) return fallback;
    return typeof fallback === 'number' ? Number(v) : v;
  } catch {
    return fallback;
  }
};

const markdownComponents = {
  h1: (props: any) => <h1 className="mb-3 mt-8 text-[1.9em] font-bold leading-snug text-slate-900" {...props} />,
  h2: (props: any) => <h2 className="mb-3 mt-7 text-[1.55em] font-bold leading-snug text-slate-900" {...props} />,
  h3: (props: any) => <h3 className="mb-2 mt-6 text-[1.25em] font-semibold leading-snug text-slate-900" {...props} />,
  h4: (props: any) => <h4 className="mb-2 mt-5 text-[1.1em] font-semibold leading-snug text-slate-800" {...props} />,
  h5: (props: any) => <h5 className="mb-2 mt-4 text-[1.05em] font-semibold text-slate-800" {...props} />,
  h6: (props: any) => <h6 className="mb-2 mt-4 text-[1em] font-semibold text-slate-800" {...props} />,
  p: (props: any) => <p className="my-[0.72em] text-justify leading-[inherit] text-slate-800" {...props} />,
  ul: (props: any) => <ul className="my-[0.72em] list-disc space-y-1 pl-6 text-slate-800" {...props} />,
  ol: (props: any) => <ol className="my-[0.72em] list-decimal space-y-1 pl-6 text-slate-800" {...props} />,
  li: (props: any) => <li className="leading-[inherit]" {...props} />,
  table: (props: any) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full border-collapse text-[0.95em]" {...props} />
    </div>
  ),
  thead: (props: any) => <thead {...props} />,
  tbody: (props: any) => <tbody {...props} />,
  tr: (props: any) => <tr className="border-b border-slate-200 last:border-0" {...props} />,
  th: (props: any) => <th className="border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold last:border-r-0" {...props} />,
  td: (props: any) => <td className="border-r border-slate-200 px-3 py-2 align-top last:border-r-0" {...props} />,
  blockquote: (props: any) => (
    <blockquote className="my-4 rounded-r-2xl border-l-4 border-lavender bg-blush/10 py-2 pl-4 pr-3 text-slate-600" {...props} />
  ),
  code: (props: any) =>
    props.className ? (
      <code className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-800" {...props} />
    ) : (
      <code className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-800" {...props} />
    ),
  pre: (props: any) => <pre className="my-4 overflow-x-auto rounded-xl bg-slate-100 p-3 text-[0.85em]" {...props} />,
  hr: () => <hr className="my-6 border-slate-200" />,
  em: (props: any) => <em {...props} />,
  strong: (props: any) => <strong className="font-semibold text-slate-900" {...props} />,
  a: (props: any) => <a className="text-sky underline decoration-sky/40" target="_blank" rel="noreferrer" {...props} />,
};

export function MarkdownReader(props: MarkdownReaderProps) {
  const {
    markdown,
    fileName,
    sourceLabel,
    units,
    onJumpToPdfPage,
    onIntensiveAnalyze,
    onLookupWord,
    onAddWord,
    onImportMarkdown,
  } = props;

  const [fontScale, setFontScale] = useState<number>(() => readPref('french-reader-font-scale', 1) as number);
  const [lineHeight, setLineHeight] = useState<number>(() => readPref('french-reader-line-height', 1.9) as number);
  const [widthMode, setWidthMode] = useState<string>(() => readPref('french-reader-width', 'normal') as string);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unitTargetPage, setUnitTargetPage] = useState<number | null>(null);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // 阅读偏好持久化
  useEffect(() => {
    try {
      window.localStorage.setItem('french-reader-font-scale', String(fontScale));
      window.localStorage.setItem('french-reader-line-height', String(lineHeight));
      window.localStorage.setItem('french-reader-width', widthMode);
    } catch {
      /* ignore */
    }
  }, [fontScale, lineHeight, widthMode]);

  const pageSegments = useMemo(() => splitMarkdownPages(markdown), [markdown]);

  // 单元跳转：滚动到目标页所在分段
  useEffect(() => {
    if (unitTargetPage == null) return;
    const el = pageRefs.current.get(unitTargetPage);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setUnitTargetPage(null);
  }, [unitTargetPage]);

  const handleUnitChange = (value: string) => {
    const index = Number(value);
    setSelectedUnitIndex(Number.isFinite(index) && index >= 0 ? index : null);
    const unit = units[index];
    if (unit?.startPage) setUnitTargetPage(unit.startPage);
  };

  const clearSelection = () => setSelection(null);

  // 点击单词 → 查词（无拖选选区时触发），取点击处所在词并带上段落上下文
  const handleClick = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, label')) return;
    if (typeof document.caretRangeFromPoint !== 'function') return;
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range || !range.startContainer || range.startContainer.nodeType !== Node.TEXT_NODE) return;
    const node = range.startContainer as Text;
    const text = node.textContent || '';
    const offset = range.startOffset;
    const re = /[a-zA-Zàâäéèêëîïôöùûüçœæ'’\-]+/g;
    let m: RegExpExecArray | null;
    let hit = '';
    while ((m = re.exec(text))) {
      if (offset >= m.index && offset <= m.index + m[0].length) {
        hit = m[0];
        break;
      }
    }
    if (!hit) return;
    const block = node.parentElement?.closest('p, li, h1, h2, h3, h4, h5, h6, td, th') as HTMLElement | null;
    void onLookupWord(hit, block?.textContent || undefined);
  };

  /** 选区变化即同步工具条：兼容拖选在容器外松开 / 双击 / 键盘 / 程序化选区 */
  const syncSelection = () => {
    const container = scrollRef.current;
    if (!container) return;
    const sel = window.getSelection();
    const text = sel ? sel.toString().replace(/\s+/g, ' ').trim() : '';
    if (!sel || !sel.rangeCount || sel.isCollapsed || !text) {
      setSelection(null);
      return;
    }
    // 过长选区（如全选整本）不弹工具条，避免误触超大请求
    if (text.length > 10000) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    // 只处理阅读器正文内的选区：祖先在容器内，或选区起点/终点至少一端在容器内（拖选越过容器边缘也弹）
    const inReader =
      container.contains(range.commonAncestorContainer) ||
      (container.contains(range.startContainer) && container.contains(range.endContainer));
    if (!inReader) return;
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setSelection({
      text,
      x: Math.min(Math.max(rect.left - containerRect.left, 8), Math.max(containerRect.width - 280, 8)),
      y: Math.max(rect.top - containerRect.top - 48, 8),
    });
  };

  // 全局监听选区变化（最稳，覆盖在容器外松开的情况）；容器内松开时再校正一次位置
  useEffect(() => {
    document.addEventListener('selectionchange', syncSelection);
    return () => document.removeEventListener('selectionchange', syncSelection);
  }, []);

  const handleMouseUp = () => {
    window.setTimeout(syncSelection, 10);
  };

  const runAction = async (action: 'analyze' | 'add') => {
    if (!selection) return;
    setActionBusy(true);
    try {
      if (action === 'analyze') await onIntensiveAnalyze(selection.text);
      else onAddWord(selection.text);
    } finally {
      setActionBusy(false);
    }
    clearSelection();
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时回退
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(fileName || '教材').replace(/\.pdf$/i, '')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await onImportMarkdown(text, file.name);
    } catch (e) {
      console.warn('导入 Markdown 失败：', e);
    } finally {
      event.target.value = '';
    }
  };

  // 当前选中单元的 Markdown（用于复制给 AI）
  const selectedUnitMd = useMemo(() => {
    if (selectedUnitIndex == null) return '';
    const unit = units[selectedUnitIndex];
    return unit?.startPage ? extractMarkdownRange(markdown, unit.startPage, unit.endPage) : '';
  }, [selectedUnitIndex, units, markdown]);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 shadow-sm">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-slate-700">📝 Markdown 精读</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{sourceLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 字号 */}
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-1.5 py-1">
            <button
              type="button"
              aria-label="缩小字号"
              onClick={() => setFontScale(s => Math.max(0.7, +(s - 0.1).toFixed(1)))}
              className="rounded-xl bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-200"
            >
              A−
            </button>
            <span className="w-9 text-center text-xs font-semibold text-slate-500">{Math.round(fontScale * 100)}%</span>
            <button
              type="button"
              aria-label="放大字号"
              onClick={() => setFontScale(s => Math.min(1.8, +(s + 0.1).toFixed(1)))}
              className="rounded-xl bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-200"
            >
              A+
            </button>
          </div>
          {/* 行距 */}
          <select
            value={lineHeight}
            onChange={e => setLineHeight(Number(e.target.value))}
            className="rounded-2xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-sky"
            title="行距"
          >
            <option value={1.6}>行距 1.6</option>
            <option value={1.9}>行距 1.9</option>
            <option value={2.2}>行距 2.2</option>
          </select>
          {/* 版宽 */}
          <select
            value={widthMode}
            onChange={e => setWidthMode(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-sky"
            title="版宽"
          >
            <option value="normal">标准版宽</option>
            <option value="wide">宽屏</option>
          </select>
          {/* 单元跳转 */}
          <select
            value={selectedUnitIndex == null ? '' : String(selectedUnitIndex)}
            onChange={e => handleUnitChange(e.target.value)}
            className="max-w-[190px] rounded-2xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-sky"
            title="跳转单元"
          >
            <option value="">跳转单元…</option>
            {units.map((unit, index) => (
              <option key={`${unit.title}-${index}`} value={String(index)}>
                {unit.title.slice(0, 26)}{unit.startPage ? `（P${unit.startPage}）` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selectedUnitIndex == null || !selectedUnitMd}
            onClick={() => void copyText(selectedUnitMd || markdown)}
            className="rounded-2xl bg-lavender/40 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-lavender/70 disabled:cursor-not-allowed disabled:opacity-40"
            title="复制当前单元 Markdown，可直接粘贴给 AI"
          >
            📋 复制单元（给 AI）
          </button>
          <button
            type="button"
            onClick={() => void copyText(markdown)}
            className="rounded-2xl bg-sky/30 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-sky/60"
          >
            {copied ? '✅ 已复制' : '📄 复制全文'}
          </button>
          <button
            type="button"
            onClick={downloadMarkdown}
            className="rounded-2xl bg-blush/40 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blush/70"
          >
            ⬇️ 下载 .md
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            📥 导入 .md
          </button>
          <input ref={importRef} type="file" accept=".md,.markdown,.txt,text/markdown" className="hidden" onChange={handleImportFile} />
        </div>
      </div>

      {/* 正文 */}
      <div
        ref={scrollRef}
        className="relative max-h-[70vh] overflow-auto rounded-b-[28px] bg-[#fffdf7] p-6"
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      >
        <div
          className={widthMode === 'wide' ? 'mx-auto max-w-none' : 'mx-auto max-w-3xl'}
          style={{ fontSize: `${16 * fontScale}px`, lineHeight }}
        >
          {pageSegments.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">暂无 Markdown 内容，可点击上方「导入 .md」加载 MarkItDown 转换结果。</p>
          )}
          {pageSegments.map(segment => (
            <div
              key={segment.page ?? 'intro'}
              data-page={segment.page ?? ''}
              ref={el => {
                if (segment.page == null) return;
                if (el) pageRefs.current.set(segment.page, el);
                else pageRefs.current.delete(segment.page);
              }}
              className="mb-8 border-b border-slate-100 pb-6 last:mb-0 last:border-0"
            >
              {segment.page != null && (
                <button
                  type="button"
                  onClick={() => { if (segment.page != null) onJumpToPdfPage(segment.page); }}
                  className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-sky/40 hover:text-slate-700"
                  title="跳转到 PDF 原页对照"
                >
                  第 {segment.page} 页 <span aria-hidden>↗</span>
                </button>
              )}
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {segment.md}
              </ReactMarkdown>
            </div>
          ))}
        </div>

        {selection && (
          <div
            className="absolute z-20 flex max-w-[90%] flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-lg"
            style={{ left: Math.max(8, selection.x), top: Math.max(8, selection.y) }}
          >
            <span className="max-w-[160px] truncate text-xs text-slate-400">“{selection.text.slice(0, 24)}”</span>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void runAction('analyze')}
              className="rounded-xl bg-lavender/40 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-lavender/70"
            >
              🧩 精析
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void runAction('add')}
              className="rounded-xl bg-gradient-to-r from-warm to-coral px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              ➕ 生词
            </button>
            <button type="button" onClick={clearSelection} className="rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-100">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
