import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

type PdfViewerProps = {
  pdfDoc: PDFDocumentProxy | null;
  targetPage: number | null;
  jumpSignal: number;
  onIntensiveAnalyze: (text: string) => Promise<void> | void;
  onLookupWord: (word: string, context?: string) => Promise<void> | void;
  onAddWord: (text: string) => void;
};

/** 合并 pdf.js 视口变换与文本项变换（等价 Util.transform） */
const combineTransform = (a: number[], b: number[]): number[] => {
  const [a1, b1, c1, d1, e1, f1] = a;
  const [a2, b2, c2, d2, e2, f2] = b;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
};

function PdfPage({
  pdfDoc,
  pageNumber,
  scale,
}: {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel: () => void } | undefined;

    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      if (cancelled) return;

      // canvas 无条件渲染，ref 恒存在；先设尺寸再 setSize，避免条件渲染导致 ref 为空
      const canvas = canvasRef.current;
      const layer = layerRef.current;
      if (!canvas || !layer) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setSize({ w: viewport.width, h: viewport.height });

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
      if (cancelled) return;

      const content = await page.getTextContent();
      if (cancelled) return;
      layer.innerHTML = '';
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue;
        const t = combineTransform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(t[2], t[3]) || 1;
        const span = document.createElement('span');
        span.textContent = item.str + (item.hasEOL ? '\n' : '');
        span.style.left = `${t[4]}px`;
        span.style.top = `${t[5] - fontHeight}px`;
        span.style.fontSize = `${fontHeight}px`;
        span.style.transform = `scaleX(${t[0] / fontHeight})`;
        span.style.transformOrigin = '0 0';
        layer.appendChild(span);
      }
    })().catch(err => console.warn(`第 ${pageNumber} 页渲染失败：`, err));

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, scale]);

  return (
    <div
      className="relative mx-auto mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-page={pageNumber}
      style={size ? { width: size.w } : undefined}
    >
      <canvas ref={canvasRef} className={size ? '' : 'invisible'} style={size ? { width: size.w, height: size.h } : undefined} />
      <div
        ref={layerRef}
        className="pdf-text-layer"
        style={size ? { width: size.w, height: size.h } : undefined}
      />
      <span className="pointer-events-none absolute bottom-2 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-500">
        第 {pageNumber} 页
      </span>
    </div>
  );
}

export function PdfViewer(props: PdfViewerProps) {
  const {
    pdfDoc,
    targetPage,
    jumpSignal,
    onIntensiveAnalyze,
    onLookupWord,
    onAddWord,
  } = props;
  const [scale, setScale] = useState(1.15);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [selectionBusy, setSelectionBusy] = useState(false);

  // 单元被选中时自动跳到对应 PDF 页
  useEffect(() => {
    if (!pdfDoc || targetPage == null) return;
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-page="${targetPage}"]`);
      if (el) {
        const canvas = el.querySelector('canvas');
        // 等待目标页渲染出实际高度后再滚动，避免在 canvas 高度为 0 时空转（最多等约 5 秒）
        const ready = !canvas || !!canvas.style.height || attempts > 20;
        if (ready) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      attempts += 1;
      setTimeout(tryScroll, 250);
    };
    tryScroll();
    return () => { cancelled = true; };
  }, [pdfDoc, targetPage, jumpSignal]);

  // 计算工具条位置
  const positionFromRange = (range: Range, containerRect: DOMRect) => {
    const rect = range.getBoundingClientRect();
    return {
      x: Math.min(Math.max(rect.left - containerRect.left, 8), containerRect.width - 280),
      y: Math.max(rect.top - containerRect.top - 56, 8),
    };
  };

  const syncSelection = () => {
    const sel = window.getSelection();
    const text = sel ? sel.toString().replace(/\s+/g, ' ').trim() : '';
    const container = containerRef.current;
    if (!sel || !container) {
      setSelection(null);
      return;
    }
    if (!sel.rangeCount || sel.isCollapsed || !text) {
      const range = sel.rangeCount ? sel.getRangeAt(0) : null;
      const insidePdf = range && container.contains(range.commonAncestorContainer);
      if (!insidePdf || !range || range.collapsed) setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    // 只处理 PDF 文字层内的选区
    if (!container.contains(range.commonAncestorContainer)) return;
    const containerRect = container.getBoundingClientRect();
    setSelection({ text, ...positionFromRange(range, containerRect) });
  };

  // 选区变化即显示工具条（兼容键盘/程序化选区），鼠标松开时再校正位置
  useEffect(() => {
    document.addEventListener('selectionchange', syncSelection);
    return () => document.removeEventListener('selectionchange', syncSelection);
  }, []);

  const handleMouseUp = () => {
    window.setTimeout(syncSelection, 10);
  };

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  // 点击文字层单词 → 查词（仅在无拖选选区时触发）
  const handleLayerClick = (e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const span = (e.target as HTMLElement).closest('.pdf-text-layer span') as HTMLElement | null;
    if (!span) return;
    const word = (span.textContent || '').trim();
    if (word) void onLookupWord(word);
  };

  const runAction = async (action: 'analyze' | 'add') => {
    if (!selection) return;
    setSelectionBusy(true);
    try {
      if (action === 'analyze') await onIntensiveAnalyze(selection.text);
      else onAddWord(selection.text);
    } finally {
      setSelectionBusy(false);
    }
    clearSelection();
  };

  if (!pdfDoc) return null;

  const pages = Array.from({ length: pdfDoc.numPages }, (_, index) => index + 1);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">📄 教材原页预览</h3>
          <p className="mt-1 text-xs text-slate-500">
            在下方 PDF 上划线选中段落 / 句子 / 单词，即可「精析」（先翻译再拆解句法）或加入生词本。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale(s => Math.max(0.6, +(s - 0.15).toFixed(2)))}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            −
          </button>
          <span className="w-12 text-center text-xs font-semibold text-slate-500">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => setScale(s => Math.min(2.5, +(s + 0.15).toFixed(2)))}
            className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            +
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative mt-4">
        <div
          className="max-h-[70vh] overflow-auto rounded-2xl bg-slate-100 p-4"
          onMouseUp={handleMouseUp}
          onClick={handleLayerClick}
        >
          {pages.map(pageNumber => (
            <PdfPage key={pageNumber} pdfDoc={pdfDoc} pageNumber={pageNumber} scale={scale} />
          ))}
        </div>

        {selection && (
          <div
            className="absolute z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-lg"
            style={{ left: selection.x, top: selection.y }}
          >
            <span className="max-w-[200px] truncate text-xs text-slate-400">
              “{selection.text.slice(0, 30)}”
            </span>
            <button
              type="button"
              disabled={selectionBusy}
              onClick={() => runAction('analyze')}
              className="rounded-xl bg-lavender/40 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-lavender/70"
            >
              🧩 精析
            </button>
            <button
              type="button"
              disabled={selectionBusy}
              onClick={() => runAction('add')}
              className="rounded-xl bg-gradient-to-r from-warm to-coral px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              ➕ 生词
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-100"
            >
              ✕
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
