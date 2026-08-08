import { describe, it, expect } from 'vitest';
import { buildUnitModulePrompt, buildUnitPracticePrompt, extractJson, isOfficialDeepSeekUrl } from './deepseek';

describe('deepseek 纯函数', () => {
  it('extractJson 解析纯 JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('extractJson 解析被代码块包裹的 JSON', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('extractJson 容错：截断的 JSON 取最长可解析前缀', () => {
    const r = extractJson('{"a":1,"b":[1,2,3]');
    expect(r).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it('isOfficialDeepSeekUrl 识别官方域名', () => {
    expect(isOfficialDeepSeekUrl('https://api.deepseek.com/chat/completions')).toBe(true);
    expect(isOfficialDeepSeekUrl('https://myproxy.com/parse')).toBe(false);
  });

  it('buildUnitModulePrompt 传入 Markdown 原文时包含它', () => {
    const prompt = buildUnitModulePrompt('Unité 1', '摘要', ['句子一'], '## 单元原文\n内容');
    expect(prompt).toContain('单元原文');
    expect(prompt).toContain('句子一');
  });

  it('buildUnitPracticePrompt 包含题型与中文翻译要求', () => {
    const prompt = buildUnitPracticePrompt({
      unitTitle: 'Unité 1', summary: '摘要', level: 'B2', excerpt: '课文', vocab: ['parler'], grammarTitles: ['虚拟式'],
    });
    expect(prompt).toContain('Unité 1');
    expect(prompt).toContain('questionZh');
    expect(prompt).toContain('B2');
  });
});
