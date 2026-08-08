import { describe, it, expect } from 'vitest';
import { extractMarkdownRange, splitMarkdownPages } from './pdfToMarkdown';

describe('pdfToMarkdown 分页工具', () => {
  it('splitMarkdownPages 按页码标记切分', () => {
    const md = '<!-- PAGE 1 -->\n\n# Unité 1\n\n<!-- PAGE 2 -->\n\nBonjour le monde.';
    const segs = splitMarkdownPages(md);
    expect(segs).toHaveLength(2);
    expect(segs[0].page).toBe(1);
    expect(segs[0].md).toContain('# Unité 1');
    expect(segs[1].page).toBe(2);
    expect(segs[1].md).toContain('Bonjour');
  });

  it('splitMarkdownPages 保留前置内容', () => {
    const md = '封面内容\n\n<!-- PAGE 1 -->\n\n正文';
    const segs = splitMarkdownPages(md);
    expect(segs[0].page).toBeNull();
    expect(segs[1].page).toBe(1);
  });

  it('extractMarkdownRange 提取单元区间', () => {
    const md = '<!-- PAGE 1 -->\n\nA\n\n<!-- PAGE 2 -->\n\nB\n\n<!-- PAGE 3 -->\n\nC';
    const range = extractMarkdownRange(md, 2, 3);
    expect(range).toContain('B');
    expect(range).toContain('C');
    expect(range).not.toContain('A');
  });

  it('extractMarkdownRange 无起页返回空', () => {
    expect(extractMarkdownRange('<!-- PAGE 1 -->\n\nA', undefined, 3)).toBe('');
  });
});
