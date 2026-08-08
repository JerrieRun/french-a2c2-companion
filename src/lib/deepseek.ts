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

/** 生成单个单元的「详细学习卡」：分类词汇 + 语法精华 + 常见错误 + 中法例句 */
export const buildUnitModulePrompt = (unitTitle: string, summary: string, sentences: string[], markdownExcerpt?: string, grammarExcerpt?: string) => {
  const excerpt = sentences.slice(0, 30).join('\n');
  const mdPart = markdownExcerpt
    ? `\n\n## 单元原文（完整 Markdown：含标题/段落/列表/表格，务必完整读完；本单元通常有 3 个 Grammaire 小节，可能以字母间距碎片形式出现如 "Gra Gra Gr Gr Grammaire …"，请逐一找出并覆盖其全部语法内容）\n${markdownExcerpt.slice(0, 40000)}`
    : '';
  const grammarPart = grammarExcerpt
    ? `\n\n## 本单元教材的 Grammaire 章节（务必逐点覆盖，一个语法点都不能漏）\n${grammarExcerpt}`
    : '';
  return `System: 你是一位资深法语教师（CEFR A2→C2），请为教材单元生成一份「详细学习卡」，严格输出合法 JSON（不要用 markdown 代码块包裹）。

格式：
{
  "vocabGroups": [
    { "category": "分类名（如：环保与可持续）", "items": [
      { "word": "法语词/词组", "translation": "中文释义", "example": "含该词的简短法语句子（可选）" }
    ] }
  ],
  "grammarTopics": [
    { "title": "语法点名称（如：Le passé composé 复合过去时）", "explanation": "中文讲解，含规则/构成/用法/例句", "table": [["列名1","列名2"],["单元格","单元格"]] }
  ],
  "commonMistakes": [
    { "wrong": "错误法语句子", "right": "正确法语句子", "note": "中文说明错在哪" }
  ],
  "exampleSentences": [
    { "zh": "中文句", "fr": "对应法语句" }
  ],
  "keySentences": [
    { "fr": "重点长难句（含从句/倒装/虚拟式/条件式等复杂结构）", "zh": "中文翻译", "analysis": "中文结构解析：拆解主句/从句、指出考点与翻译要点" }
  ],
  "writingSentences": [
    { "fr": "可直接用在作文里的高级表达句", "zh": "中文翻译", "usage": "适用场景/写作小贴士（如：议论文提出观点、举例、表因果、结尾总结）" }
  ]
}

要求：
1. 词汇按主题分类（3-6 类），每类 4-8 个词条，优先从本单元真实课文里选词，生词必须给中文释义。
2. 【语法精华必须完整】本单元通常有 3 个 Grammaire 小节，请逐一定位并覆盖每个小节的全部语法点（时态/语式/从句/代词/冠词/比较级等），一个都不能漏；列出 5-10 个语法主题（如只有 3 个小节就把每节拆细），每个主题讲解要详细、可操作，能用表格就用表格（表格首行为表头）。
3. 常见错误 3-5 条，来自本单元最易错的点。
4. 例句 10 句，中法对照，覆盖本单元核心词汇与语法。
5. 重点长难句 5-8 条：必须从本单元真实课文/例句中挑选或改写，挑结构复杂的（含从句、倒装、虚拟式、条件式、代词式动词等），analysis 用中文拆解结构并给翻译要点。
6. 写作积累句 5-8 条：选地道、可直接套用到作文里的表达（提出观点、举例、因果、让步、总结等），usage 说明适用场景。
7. 所有讲解用中文，例句必须真实自然、符合 CEFR 等级。

单元标题：${unitTitle}
单元摘要：${summary}
${mdPart}
${grammarPart}
单元课文句子（节选）：
${excerpt}`;
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

  // 截断恢复①：补上缺失的闭合括号（如 {"a":1,"b":[1,2,3] → +} 即可解析）
  for (let extra = 1; extra <= 6; extra += 1) {
    const fixed = tryParse(cleaned + '}'.repeat(extra));
    if (fixed) return fixed;
  }

  // 截断恢复②：若 JSON 被截断，尝试逐层去掉末尾不完整片段，找到最长可解析前缀
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

/** 生成单元「全题型练习」：覆盖法语考级 DELF B2 / DALF C1 / TCF 主要题型（含写作复述）。
 *  题目一律用法语，每题附 questionZh（中文翻译，默认隐藏，可点击显示）。 */
export const buildUnitPracticePrompt = (args: {
  unitTitle: string;
  summary: string;
  level: string;
  excerpt: string;
  vocab: string[];
  grammarTitles: string[];
}) => {
  const { unitTitle, summary, level, excerpt, vocab, grammarTitles } = args;
  return `System: 你是一位资深法语考级出题教师（DELF B2 / DALF C1 / TCF），请为教材单元生成一套「覆盖全部题型」的单元练习，严格输出合法 JSON（不要用 markdown 代码块包裹）。

输出 JSON 结构（所有题型都要给，不要省略；question 与指令一律用法语，另附 questionZh 中文翻译）：
{
  "listening": { "instructions": "听力做题指引（法语）", "instructionsZh": "听力做题指引（中文翻译）", "transcript": "听力文本（法语，取自课文）", "items": [ { "question": "题目（法语），如：Écoutez et répondez : vrai ou faux ?", "questionZh": "题目中文翻译", "options": ["A. ...", "B. ...", "C. ..."], "answer": "正确选项或 Vrai/Faux", "explain": "解析（中文）" } ] },
  "reading": { "passage": "阅读理解短文（法语，取自课文或改写）", "items": [ { "question": "题目（法语）", "questionZh": "中文翻译", "options": ["A. ...", "B. ...", "C. ..."], "answer": "答案", "explain": "解析（中文）" } ] },
  "grammar": { "items": [ { "question": "语法填空/选择题干（法语），如：Il faut que tu ___ (faire) tes devoirs.", "questionZh": "中文翻译", "options": ["fasses", "fais", "faisais"], "answer": "fasses", "explain": "解析（中文）" } ] },
  "cloze": { "title": "完形填空标题（法语）", "text": "带空格的短文（法语，用 ____ 表示空格）", "items": [ { "question": "第 1 空的提示（法语），如：Conjuguez le verbe au subjonctif.", "questionZh": "中文翻译", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "正确选项", "explain": "解析（中文）" } ] },
  "vocabulary": { "items": [ { "question": "词汇题（法语题干）", "questionZh": "中文翻译", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "正确选项", "explain": "解析（中文）" } ] },
  "ordering": { "items": [ { "sentences": ["打乱的句子（法语）", "句子2", "句子3", "句子4"], "answer": "正确顺序，如 2-1-4-3", "explain": "解析（中文）" } ] },
  "correction": { "items": [ { "wrong": "错误句（法语）", "right": "正确句（法语）", "note": "错因说明（中文）" } ] },
  "writing": { "prompt": "书面表达题目（法语+字数要求；必须包含「写作复述」：复述课文/写摘要/写邮件等，对齐 ${level} 级考纲）", "promptZh": "题目中文翻译", "tips": ["写作提示（法语）", "提示2", "提示3"], "modelAnswer": "参考范文（法语）" },
  "oral": { "prompt": "口语题目（法语+时间要求，如：就本单元主题做 2-3 分钟独白或复述）", "promptZh": "题目中文翻译", "points": ["要点（法语）", "要点2", "要点3"], "modelAnswer": "参考表达（法语）" }
}

要求：
1. 难度对齐 ${level} 级法语考纲（DELF B2 / DALF C1 / TCF 对应题型），题目全部围绕本单元主题、词汇与语法点。
2. 每类题型 2-4 题；听力/阅读尽量使用本单元课文素材。
3. 题干、选项、指令一律使用法语（沉浸式）；每题必须附 questionZh / instructionsZh / promptZh 中文翻译（仅作学习参考）。
4. 书面表达（writing）必须包含「写作复述」类型（复述课文/摘要/信件/议论文），并给出参考范文。
5. 解析（explain）、错因（note）用中文。
6. 本单元语法点：${grammarTitles.join('、') || '（由你根据课文提炼）'}

单元标题：${unitTitle}
单元摘要：${summary}
本单元核心词汇：${vocab.join('、')}
课文/素材（Markdown）：
${(excerpt || '').slice(0, 6000)}`;
};

