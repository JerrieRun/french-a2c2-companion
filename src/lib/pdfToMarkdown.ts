/**
 * 客户端 PDF → Markdown 转换器
 *
 * 思路参考微软开源工具 MarkItDown（基于 pdfminer 的版式分析）：
 * 利用 pdf.js 已提取的文本项（坐标/字号/字体），重建标题、段落、列表、表格等结构，
 * 产出「AI 更易识别」的结构化 Markdown。纯浏览器运行、无需上传，适合大体积教材。
 *
 * 输出约定：每页以 `<!-- PAGE n -->` 注释标记，便于精读页分页展示与单元跳页。
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type MarkdownProgress = (done: number, total: number) => void;

type RawItem = {
  str: string;
  x: number;
  y: number; // PDF 用户空间 y（越大越靠上）
  height: number; // 字号（PDF 用户空间单位）
  bold: boolean;
};

type Cell = { x0: number; text: string; height: number; bold: boolean };

type Line = {
  y: number;
  x0: number;
  fontSize: number;
  bold: boolean;
  cells: Cell[];
  text: string;
  columns: string[] | null; // 多列检测结果（表格候选）
};

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; lines: string[] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; rows: string[][] };

const isBoldFont = (fontName: string) =>
  /bold|black|heavy|demibold|semibold|extrabold/i.test(fontName);

const isPageNumberLine = (text: string) =>
  /^\d{1,3}$/.test(text.trim()) || /^[ivxlc]{1,5}$/i.test(text.trim());

function pageToMarkdown(content: { items: Array<any> }, pageNo: number): string {
  // 1. 收集原始文本项
  const raw: RawItem[] = [];
  for (const item of content.items) {
    if (!item.str || !item.transform || !item.str.trim()) continue;
    const [, , c, d, e, f] = item.transform;
    const height = Math.hypot(c, d) || 1;
    raw.push({
      str: item.str,
      x: e,
      y: f,
      height,
      bold: isBoldFont(item.fontName || ''),
    });
  }
  if (raw.length === 0) {
    return `<!-- 第 ${pageNo} 页无可提取文字（可能是扫描/图片页，建议用微软 MarkItDown 或 OCR） -->`;
  }

  // 2. 按行聚类：y 相近的项合并为一行（先按 y 降序，再按 x 升序）
  raw.sort((p, q) => q.y - p.y || p.x - q.x);
  const lines: Line[] = [];
  for (const it of raw) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Math.max(last.fontSize, it.height) * 0.5) {
      last.cells.push({ x0: it.x, text: it.str, height: it.height, bold: it.bold });
      last.fontSize = Math.max(last.fontSize, it.height);
      if (it.bold) last.bold = true;
    } else {
      lines.push({
        y: it.y,
        x0: it.x,
        fontSize: it.height,
        bold: it.bold,
        cells: [{ x0: it.x, text: it.str, height: it.height, bold: it.bold }],
        text: '',
        columns: null,
      });
    }
  }

  // 3. 行内：单元格按 x 排序 → 拼接文本；同时做多列（表格）候选检测
  const estimateWidth = (cell: Cell) => cell.text.length * cell.height * 0.5;
  for (const line of lines) {
    line.cells.sort((p, q) => p.x0 - q.x0);
    const threshold = Math.max(line.fontSize * 1.6, 6);
    const clusters: Cell[][] = [];
    for (const cell of line.cells) {
      const lastCluster = clusters[clusters.length - 1];
      const lastCell = lastCluster ? lastCluster[lastCluster.length - 1] : null;
      const gap = lastCell ? cell.x0 - (lastCell.x0 + estimateWidth(lastCell)) : 0;
      if (lastCluster && gap < threshold) {
        lastCluster.push(cell);
      } else {
        clusters.push([cell]);
      }
    }
    const isMarkerText = (t: string) => /^[•▪●◦‣·\-–—]$/.test(t) || /^\d{1,2}[.)]?$/.test(t);
    const firstText = clusters.length ? clusters[0].map(c => c.text).join(' ').trim() : '';
    const lastText = clusters.length > 1 ? clusters[clusters.length - 1].map(c => c.text).join(' ').trim() : '';
    const mergedText =
      clusters.length === 2 && (isMarkerText(firstText) || isMarkerText(lastText))
        ? clusters.flatMap(cl => cl.map(c => c.text)).join(' ').trim().replace(/\s+/g, ' ')
        : '';
    if (mergedText) {
      // 列表标记（• / 1.）与正文拆成两列 → 合并为普通行，避免误判为表格
      line.columns = null;
      line.text = mergedText;
    } else {
      line.columns = clusters.length >= 2 ? clusters.map(cl => cl.map(c => c.text).join(' ').trim()) : null;
      line.text = line.columns
        ? line.columns.join(' ')
        : line.cells.map(c => c.text).join(' ').trim().replace(/\s+/g, ' ');
    }
    line.x0 = line.cells[0].x0;
  }

  // 4. 正文基准字号：取「非列表行」字号的众数（列表项/表格字号常与正文不同，会把中位数抬偏）
  const isListLikeText = (text: string) => /^[•▪●◦‣·\-–—]\s/.test(text) || /^\d{1,2}[.)]?\s/.test(text);
  const bodyCandidates = lines.filter(l => !isListLikeText(l.text)).map(l => l.fontSize);
  const sizeCounts = new Map<number, number>();
  for (const s of bodyCandidates) {
    const key = Math.round(s * 2) / 2;
    sizeCounts.set(key, (sizeCounts.get(key) || 0) + 1);
  }
  let bodySize = bodyCandidates[Math.floor(bodyCandidates.length / 2)] || 12;
  let bestCount = 0;
  for (const key of Array.from(sizeCounts.keys()).sort((a, b) => a - b)) {
    const count = sizeCounts.get(key)!;
    if (count > bestCount) {
      bestCount = count;
      bodySize = key;
    }
  }

  // 5. 表格检测：连续 ≥3 行、列数相同（2~5 列）→ 表格
  const tableStart = new Map<number, string[][]>();
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    if (!line.columns || line.columns.length < 2 || line.columns.length > 5) continue;
    if (line.fontSize / bodySize >= 1.3) continue;
    const colCount = line.columns.length;
    let end = idx;
    while (
      end < lines.length &&
      lines[end].columns &&
      lines[end].columns!.length === colCount &&
      lines[end].fontSize / bodySize < 1.3
    ) {
      end += 1;
    }
    if (end - idx >= 3) {
      tableStart.set(idx, lines.slice(idx, end).map(l => l.columns!.map(c => c.replace(/\|/g, '\\|'))));
      idx = end - 1;
    }
  }

  // 6. 逐行转语义块
  const blocks: Block[] = [];
  let para: string[] = [];
  let currentList: { ordered: boolean; items: string[] } | null = null;
  let prevY: number | null = null;
  let prevX0: number | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'paragraph', lines: para });
      para = [];
    }
  };
  const flushList = () => {
    if (currentList) {
      blocks.push({ type: 'list', ordered: currentList.ordered, items: currentList.items });
      currentList = null;
    }
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const text = line.text.trim();
    if (!text) continue;

    // 表格块
    if (tableStart.has(idx)) {
      flushPara();
      flushList();
      const rows = tableStart.get(idx)!;
      blocks.push({ type: 'table', rows });
      const end = idx + rows.length;
      prevY = lines[end - 1].y;
      prevX0 = lines[end - 1].x0;
      idx = end - 1;
      continue;
    }

    // 页码等纯数字行 → 跳过
    if (isPageNumberLine(text)) {
      flushPara();
      flushList();
      prevY = line.y;
      prevX0 = line.x0;
      continue;
    }

    // 标题：字号 ≥ 1.2×正文基准（列表行除外，先交给列表判定）
    const ratio = line.fontSize / bodySize;
    const isHeading = ratio >= 1.2 && text.length <= 90 && !isListLikeText(text);
    if (isHeading) {
      flushPara();
      flushList();
      const level = ratio >= 1.8 ? 1 : ratio >= 1.5 ? 2 : 3;
      blocks.push({ type: 'heading', level, text: text.replace(/#/g, '').trim() });
      prevY = line.y;
      prevX0 = line.x0;
      continue;
    }

    // 列表：行首为符号或数字序号
    const listMatch = text.match(/^(?:(?:[-–—•▪●◦‣·])|(?:\d{1,2}[.)]?))\s+(.+)$/);
    if (listMatch) {
      flushPara();
      const ordered = /^\d/.test(text);
      const itemText = listMatch[1].trim();
      if (currentList && currentList.ordered === ordered) {
        currentList.items.push(itemText);
      } else {
        flushList();
        currentList = { ordered, items: [itemText] };
      }
      prevY = line.y;
      prevX0 = line.x0;
      continue;
    }
    flushList();

    // 段落：行距/缩进判断是否同一段
    const gap = prevY !== null ? prevY - line.y : 0;
    const indentShift = prevX0 !== null ? Math.abs(line.x0 - prevX0) : 0;
    const samePara =
      prevY !== null && gap < Math.max(bodySize * 1.7, line.fontSize * 1.7) && indentShift < bodySize * 1.2;
    if (!samePara && para.length) flushPara();

    // 断行连字符处理（"cat-" + "astrophe" → "catastrophe"）
    if (para.length && /\w[-–]$/.test(para[para.length - 1]) && /^[a-zàâäéèêëîïôöùûüçœæ]/.test(text)) {
      para[para.length - 1] = para[para.length - 1].replace(/[-–]$/, '') + text;
    } else {
      para.push(text);
    }
    prevY = line.y;
    prevX0 = line.x0;
  }
  flushPara();
  flushList();

  // 7. 序列化
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === 'heading') {
      parts.push(`${'#'.repeat(block.level)} ${block.text}`);
    } else if (block.type === 'paragraph') {
      parts.push(block.lines.join(' '));
    } else if (block.type === 'list') {
      parts.push(block.items.map((item, k) => (block.ordered ? `${k + 1}. ${item}` : `- ${item}`)).join('\n'));
    } else {
      const [header, ...rows] = block.rows;
      const sep = `| ${Array.from({ length: header.length }, () => '---').join(' | ')} |`;
      parts.push(`| ${header.join(' | ')} |\n${sep}\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}`);
    }
  }
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n');
}

/** 整本 PDF → Markdown（逐页处理，支持进度回调；每 4 页让出主线程保持 UI 响应） */
export async function pdfToMarkdown(pdfDoc: PDFDocumentProxy, onProgress?: MarkdownProgress): Promise<string> {
  const parts: string[] = [];
  const total = pdfDoc.numPages;
  for (let pageNo = 1; pageNo <= total; pageNo += 1) {
    const page = await pdfDoc.getPage(pageNo);
    const content = await page.getTextContent();
    const body = pageToMarkdown(content, pageNo);
    parts.push(`<!-- PAGE ${pageNo} -->\n\n${body}`);
    onProgress?.(pageNo, total);
    if (pageNo % 4 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  return parts.join('\n\n').trim();
}

/** 按 `<!-- PAGE n -->` 把整份 Markdown 切成带页码的分段（精读页分页渲染用） */
export function splitMarkdownPages(markdown: string): { page: number | null; md: string }[] {
  const segments: { page: number | null; md: string }[] = [];
  const parts = markdown.split(/<!--\s*PAGE\s+(\d+)\s*-->/g);
  const before = parts.shift();
  if (before && before.trim()) segments.push({ page: null, md: before.trim() });
  while (parts.length >= 2) {
    const page = parseInt(parts.shift()!, 10);
    const md = (parts.shift() || '').trim();
    if (md) segments.push({ page, md });
  }
  if (parts.length && parts[0].trim()) segments.push({ page: null, md: parts[0].trim() });
  return segments;
}

/** 提取某单元（startPage~endPage）对应的 Markdown 片段，用于喂给 AI / 复制单元 */
export function extractMarkdownRange(markdown: string, startPage?: number, endPage?: number): string {
  if (!startPage) return '';
  const segments = splitMarkdownPages(markdown);
  const startIdx = segments.findIndex(s => s.page === startPage);
  if (startIdx < 0) return '';
  let endIdx = startIdx;
  if (endPage) {
    const e = segments.findIndex(s => s.page === endPage);
    if (e >= startIdx) endIdx = e;
  }
  return segments
    .slice(startIdx, endIdx + 1)
    .map(s => s.md)
    .filter(Boolean)
    .join('\n\n');
}
