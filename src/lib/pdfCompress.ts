/**
 * 浏览器端 PDF 自动压缩（适用于超 50MB 的大教材，上传到 Supabase 前调用）
 *
 * 原理：
 *  1. 用 pdf.js 把每页渲染成低分辨率 JPEG（保留视觉内容）；
 *  2. 用 pdf-lib 重建 PDF：原始页尺寸 + 页面图片 + 「隐形文字层」（Tr=3 渲染模式），
 *     文字按原坐标/字号叠加，保证重新解析时文字层仍在（精读/查词/单元拆分不受影响）。
 *
 * 阈值外的文件不动，直接返回原数据。
 */
import { PDFDocument, PDFNumber, PDFOperator, PDFOperatorNames, StandardFonts } from 'pdf-lib';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';

export type CompressProgress = (done: number, total: number) => void;

/** 目标页宽（像素），约 140-150 DPI，清晰度与体积平衡 */
const MAX_PAGE_WIDTH = 1000;
/** 大于该体积（字节）才压缩，默认 45MB */
const DEFAULT_THRESHOLD = 45 * 1024 * 1024;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function compressPdf(
  data: ArrayBuffer,
  onProgress?: CompressProgress,
  threshold = DEFAULT_THRESHOLD
): Promise<ArrayBuffer> {
  if (data.byteLength <= threshold) return data;

  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf');
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const pdf = await getDocument({ data }).promise;
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const total = pdf.numPages;

  for (let pageNo = 1; pageNo <= total; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_PAGE_WIDTH / (baseViewport.width || 1), 1.8);
    const viewport = page.getViewport({ scale });

    // 渲染页面为 JPEG
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const jpegBytes = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.65));

    // 新页：原始尺寸 + 图片 + 隐形文字层
    const newPage = out.addPage([baseViewport.width, baseViewport.height]);
    const img = await out.embedJpg(jpegBytes);
    newPage.drawImage(img, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
    newPage.pushOperators(PDFOperator.of(PDFOperatorNames.SetTextRenderingMode, [PDFNumber.of(3)]));

    const content = await page.getTextContent();
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      if (!item.str || !item.transform) continue;
      const clean = item.str.replace(/[\u0000-\u001f]/g, '').trim();
      if (!clean) continue;
      const [, , c, d, e, f] = item.transform;
      const size = Math.hypot(c, d) || 10;
      try {
        newPage.drawText(clean, { x: e, y: f, size, font });
      } catch {
        // 个别字符无法用标准字体编码时跳过，不影响整体
      }
    }

    onProgress?.(pageNo, total);
    if (pageNo % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }

  const bytes = await out.save({ useObjectStreams: true });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
