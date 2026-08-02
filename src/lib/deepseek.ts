export type DeepSeekChatConfig = {
  apiKey: string;
  officialUrl: string;
  model: string;
};

export const buildDeepSeekPrompt = (sentence: string) => {
  return `System: 你是一个法语高级教育助手，负责提供精准的语法分析、句法拆解、词汇等级标注和翻译建议。请用中文解释。

User: 请对以下法语句子进行分析，并给出：\n1. 句子成分拆解（主谓宾、从句类型、时态）\n2. 可能出现的典型错误\n3. 该句中的高级词汇和 CEFR 等级建议。\n\n句子：${sentence}`;
};

export const buildPracticePrompt = (sentence: string) => {
  return `System: 你是一个法语学习助手，负责基于教材句子生成练习题。请输出 3 条适合中高级学习者的题目。\n\n句子：${sentence}`;
};

export const buildParsePrompt = (text: string) => {
  return `System: 你是一个法语高级教育助手，负责读取法语教材并按单元拆分结构化内容。请输出每个单元的标题、摘要、核心词汇与示例练习题，结构化为 JSON。\n\n文本：${text}`;
};

export const buildDeepSeekUrl = (endpoint: string, suffix: string) => {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    throw new Error('DeepSeek 接口地址不能为空。');
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('DeepSeek 地址必须是有效的 HTTP 或 HTTPS URL。');
  }
  if (trimmed.toLowerCase().endsWith(`/${suffix}`)) {
    return trimmed;
  }
  return `${trimmed.replace(/\/+$/, '')}/${suffix}`;
};

export const isOfficialDeepSeekUrl = (url: string) => {
  return /deepseek\.com/i.test(url);
};

export const resolveCustomEndpoint = (explicitUrl: string, baseUrl: string) => {
  if (explicitUrl && !isOfficialDeepSeekUrl(explicitUrl)) return explicitUrl;
  if (!explicitUrl && baseUrl && !isOfficialDeepSeekUrl(baseUrl)) return baseUrl;
  return '';
};

export const callDeepSeekChat = async (
  config: DeepSeekChatConfig,
  system: string,
  user: string,
  maxTokens = 8192
) => {
  if (!config.apiKey) {
    throw new Error('直连 DeepSeek 官方 API 需要填写 API Key。');
  }
  const base = (config.officialUrl || 'https://api.deepseek.com').trim().replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`DeepSeek 官方 API 返回 ${response.status}，请求 ${url}，响应：${responseText.slice(0, 320)}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('DeepSeek 官方 API 未返回有效内容。');
  }
  return content;
};

export const extractJson = (text: string): any => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const tryParse = (s: string): any => {
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  // 若 JSON 被截断，尝试逐层去掉末尾不完整片段，找到最长可解析前缀
  const start = cleaned.indexOf('{');
  if (start !== -1) {
    let pos = cleaned.lastIndexOf('}');
    while (pos > start) {
      const parsed = tryParse(cleaned.slice(start, pos + 1));
      if (parsed) return parsed;
      pos = cleaned.lastIndexOf('}', pos - 1);
    }
  }
  const arrStart = cleaned.indexOf('[');
  if (arrStart !== -1) {
    let pos = cleaned.lastIndexOf(']');
    while (pos > arrStart) {
      const parsed = tryParse(cleaned.slice(arrStart, pos + 1));
      if (parsed) return parsed;
      pos = cleaned.lastIndexOf(']', pos - 1);
    }
  }
  throw new Error(`无法解析 DeepSeek 返回的 JSON 内容（返回文本长度 ${cleaned.length} 字符）。`);
};
