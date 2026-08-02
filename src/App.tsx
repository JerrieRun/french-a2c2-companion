import { useEffect, useMemo, useState } from 'react';
import './App.css';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import { UnitPracticeCard } from './components/UnitPracticeCard';
import { buildDeepSeekPrompt, buildParsePrompt, buildPracticePrompt, buildDeepSeekUrl,
  callDeepSeekChat, extractJson, isOfficialDeepSeekUrl, resolveCustomEndpoint } from './lib/deepseek';
import type { AnalysisRecord, AnalysisResult, MaterialPreview, TabKey, UnitSection, WordCandidate } from './types';
import { UnitSummaryCard } from './components/UnitSummaryCard';
import { UnitVocabularyCard } from './components/UnitVocabularyCard';

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('materials');
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [materialPreview, setMaterialPreview] = useState<MaterialPreview | null>(null);
  const [candidateWords, setCandidateWords] = useState<WordCandidate[]>([]);
  const [wordBook, setWordBook] = useState<WordCandidate[]>([]);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number>(0);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisPrompt, setAnalysisPrompt] = useState<string | null>(null);
  const [deepSeekParsePrompt, setDeepSeekParsePrompt] = useState<string | null>(null);
  const [deepSeekParseResponse, setDeepSeekParseResponse] = useState<string | null>(null);
  const [parseMode, setParseMode] = useState<'auto' | 'deepseek' | 'local'>('auto');
  const [parseMethod, setParseMethod] = useState<string>('未解析');
  const [deepSeekTestStatus, setDeepSeekTestStatus] = useState<string | null>(null);
  const [deepSeekTesting, setDeepSeekTesting] = useState(false);
  const [practicePrompt, setPracticePrompt] = useState<string | null>(null);
  const [deepSeekApiUrl, setDeepSeekApiUrl] = useState<string>(import.meta.env.VITE_DEEPSEEK_API_URL || '');
  const [deepSeekParseUrl, setDeepSeekParseUrl] = useState<string>('');
  const [deepSeekAnalyzeUrl, setDeepSeekAnalyzeUrl] = useState<string>('');
  const [deepSeekPracticeUrl, setDeepSeekPracticeUrl] = useState<string>('');
  const [deepSeekApiKey, setDeepSeekApiKey] = useState<string>(import.meta.env.VITE_DEEPSEEK_API_KEY || '');
  const [deepSeekModel, setDeepSeekModel] = useState<string>(import.meta.env.VITE_DEEPSEEK_MODEL || 'deepseek-chat');
  const [deepSeekOfficialUrl, setDeepSeekOfficialUrl] = useState<string>(import.meta.env.VITE_DEEPSEEK_OFFICIAL_URL || 'https://api.deepseek.com');
  const deepSeekHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(deepSeekApiKey ? { Authorization: `Bearer ${deepSeekApiKey}` } : {}),
    }),
    [deepSeekApiKey]
  );
  const [practiceExercises, setPracticeExercises] = useState<string[]>([]);
  const [deepSeekConfigSaved, setDeepSeekConfigSaved] = useState(false);
  const [deepSeekConfigOpen, setDeepSeekConfigOpen] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisRecord[]>([]);
  const [expandedHistoryIndex, setExpandedHistoryIndex] = useState<number | null>(null);
  const [showFullText, setShowFullText] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedUrl = window.localStorage.getItem('deepseek-api-url');
    const savedParseUrl = window.localStorage.getItem('deepseek-parse-url');
    const savedAnalyzeUrl = window.localStorage.getItem('deepseek-analyze-url');
    const savedPracticeUrl = window.localStorage.getItem('deepseek-practice-url');
    const savedKey = window.localStorage.getItem('deepseek-api-key');
    const savedModel = window.localStorage.getItem('deepseek-model');
    const savedOfficialUrl = window.localStorage.getItem('deepseek-official-url');
    if (savedUrl) setDeepSeekApiUrl(savedUrl);
    if (savedParseUrl) setDeepSeekParseUrl(savedParseUrl);
    if (savedAnalyzeUrl) setDeepSeekAnalyzeUrl(savedAnalyzeUrl);
    if (savedPracticeUrl) setDeepSeekPracticeUrl(savedPracticeUrl);
    if (savedKey) setDeepSeekApiKey(savedKey);
    if (savedModel) setDeepSeekModel(savedModel);
    if (savedOfficialUrl) setDeepSeekOfficialUrl(savedOfficialUrl);

    const savedWordBook = window.localStorage.getItem('french-word-book');
    if (savedWordBook) {
      try {
        setWordBook(JSON.parse(savedWordBook));
      } catch (error) {
        console.warn('加载生词本失败：', error);
      }
    }

    const savedHistory = window.localStorage.getItem('french-analysis-history');
    if (savedHistory) {
      try {
        setAnalysisHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.warn('加载分析历史失败：', error);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('french-word-book', JSON.stringify(wordBook));
  }, [wordBook]);

  useEffect(() => {
    window.localStorage.setItem('french-analysis-history', JSON.stringify(analysisHistory));
  }, [analysisHistory]);

  useEffect(() => {
    window.localStorage.setItem('deepseek-api-url', deepSeekApiUrl);
    window.localStorage.setItem('deepseek-parse-url', deepSeekParseUrl);
    window.localStorage.setItem('deepseek-analyze-url', deepSeekAnalyzeUrl);
    window.localStorage.setItem('deepseek-practice-url', deepSeekPracticeUrl);
    window.localStorage.setItem('deepseek-api-key', deepSeekApiKey);
    window.localStorage.setItem('deepseek-model', deepSeekModel);
    window.localStorage.setItem('deepseek-official-url', deepSeekOfficialUrl);
  }, [deepSeekApiUrl, deepSeekParseUrl, deepSeekAnalyzeUrl, deepSeekPracticeUrl, deepSeekApiKey, deepSeekModel, deepSeekOfficialUrl]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPdfName(file.name);
    setError(null);
    setPdfText('正在提取文本...');
    setMaterialPreview(null);
    setLoading(true);

    const isPdfFile = file.type.toLowerCase().includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfFile) {
      setError('当前仅支持 PDF 文件上传。');
      setPdfText('');
      setLoading(false);
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const text = await extractTextFromPdf(arrayBuffer);
      const preview = buildMaterialPreview(text);
      const units = await parsePdfUnits(text);
      const candidates = extractWordCandidates(text);
      setPdfText(text || '无法识别 PDF 内容，请尝试其他文件。');
      setMaterialPreview({ ...preview, units });
      setSelectedUnitIndex(0);
      setCandidateWords(candidates);
    } catch (e) {
      console.error('PDF 提取失败：', e);
      const message = e instanceof Error ? e.message : String(e);
      setError(`PDF 文本提取失败，请稍后再试。${message ? ` 错误：${message}` : ''}`);
      setPdfText('');
    } finally {
      setLoading(false);
    }
  };

  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer) => {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf');
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    const loadingTask = getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let extracted = '';
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => ('str' in item ? item.str : '')).join(' ');
      extracted += `\n\n第 ${pageIndex} 页:\n${pageText}`;
    }
    return extracted.trim();
  };

  const buildMaterialPreview = (text: string): MaterialPreview => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const sentences = normalized
      .split(/(?<=[。！？!?\.])/)
      .map(item => item.trim())
      .filter(Boolean);

    const unitSplit = normalized.split(/(?=(?:第\s*\d+\s*单元|第\s*[一二三四五六七八九十]+\s*单元|单元\s*\d+|[Uu]nit[eé]\s*[IVXLCDM\d]+|Chapitre\s*\d+|章\s*\d+))/gi).map(item => item.trim()).filter(Boolean);

    const units = unitSplit.length > 1 ? unitSplit.map(section => {
      const titleMatch = section.match(/^(?:第\s*\d+\s*单元|第\s*[一二三四五六七八九十]+\s*单元|单元\s*\d+|[Uu]nit[eé]\s*[IVXLCDM\d]+|Chapitre\s*\d+|章\s*\d+)/i);
      const title = titleMatch ? titleMatch[0] : '单元';
      const body = titleMatch ? section.slice(titleMatch[0].length).trim() : section;
      const sentencesInUnit = body
        .split(/(?<=[。！？!?\.])/)
        .map(item => item.trim())
        .filter(Boolean);
      const vocabulary = extractWordCandidates(body).slice(0, 6);
      return {
        title,
        summary: sentencesInUnit.slice(0, 3).join(' '),
        excerpt: sentencesInUnit.slice(0, 3).join(' '),
        sentences: sentencesInUnit,
        vocabulary,
        practice: [
          `请翻译本单元第一句：“${sentencesInUnit[0] ?? ''}”。`,
          '请列出本单元中的 3 个核心词汇并说明用法。',
          '请写一句与本单元主题相关的法语句子。',
        ],
      };
    }) : [{
      title: '整册教材',
      summary: sentences.slice(0, 4).join(' '),
      excerpt: sentences.slice(0, 4).join(' '),
      sentences,
      vocabulary: extractWordCandidates(text).slice(0, 6),
      practice: [
        '请概述本教材的核心主题。',
        '请列出该单元中 3 个关键法语词汇并解释。',
        '请根据教材内容写一句简短总结。',
      ],
    }];

    return {
      title: pdfName ?? '新教材',
      pages: (normalized.match(/第 \d+ 页/g)?.length ?? 0) || 1,
      excerpt: sentences.slice(0, 4).join(' '),
      sentences,
      units,
    };
  };

  const extractWordCandidates = (text: string): WordCandidate[] => {
    const normalized = text.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿæœ\s]/gi, ' ');
    const words = normalized.split(/\s+/).filter(Boolean);
    const stopwords = new Set(['de', 'la', 'le', 'et', 'les', 'des', 'un', 'une', 'en', 'du', 'que', 'qui', 'pour', 'dans', 'est', 'pas', 'sur', 'se', 'il', 'elle', 'au', 'aux']);
    const frequencyMap = words.reduce<Record<string, number>>((acc, word) => {
      if (word.length <= 2 || stopwords.has(word)) return acc;
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(frequencyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word, freq]) => ({
        text: word,
        frequency: freq,
        cefr: getCeFrTag(word),
        translation: translateWord(word),
      }));
  };

  const getCeFrTag = (word: string): WordCandidate['cefr'] => {
    if (word.length <= 4) return 'A2';
    if (word.length <= 6) return 'B1';
    if (word.length <= 8) return 'B2';
    if (word.length <= 10) return 'C1';
    return 'C2';
  };

  const translateWord = (word: string) => {
    const dictionary: Record<string, string> = {
      bonjour: '你好',
      merci: '谢谢',
      amour: '爱情',
      "aujourd'hui": '今天',
      toujours: '总是',
      français: '法语',
      écrire: '写',
      parler: '说',
      maison: '房子',
      voyage: '旅行',
      histoire: '历史',
      important: '重要',
      malheureusement: '不幸地',
      cependant: '然而',
    };
    return dictionary[word] ?? '待补充';
  };

  const translateSentence = (sentence: string) => {
    return sentence
      .split(/\s+/)
      .map(token => translateWord(token.replace(/[^a-zàâçéèêëîïôûùüÿæœ]/gi, '').toLowerCase()) || token)
      .join(' ');
  };

  const generateDeepSeekStudyPlan = (units: UnitSection[]) => {
    if (units.length === 0) return [];

    const overview = [
      `DeepSeek 已解析出 ${units.length} 个单元。建议先按单元顺序逐个学习，先掌握主题词汇，再分析关键句型。`,
      '每个单元先阅读摘要并提取核心主题词，然后选择 1-2 句进行语法拆解和句型归纳。',
      '将核心词汇加入生词本，之后用这些词汇造句或写一段简短总结。',
      '通过生成练习题、口语模拟或写作复述，巩固本单元的语法与表达。',
    ];

    const unitDetails = units.slice(0, 4).map((unit, index) =>
      `单元 ${index + 1} (${unit.title})：${unit.summary || '请先阅读本单元主题内容，再从中摘取关键句做分析。'}`
    );

    return [...overview, ...unitDetails];
  };

  const deepSeekStudyPlan = useMemo(
    () => (materialPreview ? generateDeepSeekStudyPlan(materialPreview.units) : []),
    [materialPreview]
  );

  const parsePdfUnits = async (text: string) => {
    if (parseMode === 'local') {
      setParseMethod('本地解析');
      setDeepSeekParsePrompt(null);
      setDeepSeekParseResponse(null);
      return buildLocalUnitsFromText(text);
    }

    const prompt = buildParsePrompt(text);
    setDeepSeekParsePrompt(prompt);

    try {
      let data: any;
      const customEndpoint = resolveCustomEndpoint(deepSeekParseUrl, deepSeekApiUrl);
      if (customEndpoint) {
        const url = buildDeepSeekUrl(customEndpoint, 'parse');
        const response = await fetch(url, {
          method: 'POST',
          headers: deepSeekHeaders,
          body: JSON.stringify({ text, prompt, source: pdfName }),
        });
        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(`DeepSeek Parse API 返回 ${response.status}，请求 ${url}，响应：${responseText.slice(0, 320)}`);
        }
        data = await response.json();
      } else {
        // 教材全文可能很长，截断发送给模型的文本，避免输入超限
        const maxSendChars = 120000;
        const sendText = text.length > maxSendChars ? text.slice(0, maxSendChars) : text;
        const content = await callDeepSeekChat({ apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          '你是一个法语高级教育助手，负责读取法语教材并按单元拆分结构化内容。请严格输出合法 JSON（不要用 markdown 代码块包裹），格式为：{"units":[{"title":"单元标题","summary":"摘要","sentences":["句子1","句子2"],"vocabulary":["单词1","单词2"],"practice":["练习题1","练习题2"]}]}。',
          buildParsePrompt(sendText),
          8192
        );
        try {
          data = extractJson(content);
        } catch (e) {
          // 保留原始返回，方便在页面上诊断
          setDeepSeekParseResponse(content.slice(0, 4000));
          throw e;
        }
      }

      const units = Array.isArray(data) ? data : data.units;
      if (!Array.isArray(units) || !units.length) {
        throw new Error('DeepSeek Parse API 未返回单元数据');
      }

      setParseMethod('DeepSeek 解析');
      setDeepSeekParseResponse(JSON.stringify(data, null, 2));
      return units.map((unit: any) => ({
        title: String(unit.title ?? '单元'),
        summary: String(unit.summary ?? unit.excerpt ?? ''),
        excerpt: String(unit.excerpt ?? ''),
        sentences: Array.isArray(unit.sentences) ? unit.sentences.map(String) : [],
        vocabulary: Array.isArray(unit.vocabulary)
          ? unit.vocabulary.map((word: string) => ({
              text: String(word),
              frequency: 1,
              cefr: getCeFrTag(String(word)),
              translation: translateWord(String(word).toLowerCase()),
            }))
          : [],
        practice: Array.isArray(unit.practice) ? unit.practice.map(String) : [],
      }));
    } catch (error) {
      console.warn('DeepSeek 单元解析失败，使用本地拆分结果。', error);
      setParseMethod('本地解析');
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDeepSeekParseResponse(prev => {
        const header = `⚠️ DeepSeek 解析失败：${errorMessage}`;
        if (prev) return `${header}\n\n--- 原始返回（前 4000 字符） ---\n${prev}`;
        return header;
      });
      const localUnits = buildLocalUnitsFromText(text);
      return localUnits;
    }
  };

  const buildLocalUnitsFromText = (text: string): UnitSection[] => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const unitSplit = normalized
      .split(/(?=(?:第\s*\d+\s*单元|第\s*[一二三四五六七八九十]+\s*单元|单元\s*\d+|[Uu]nit[eé]\s*[IVXLCDM\d]+|Chapitre\s*\d+|章\s*\d+))/gi)
      .map(item => item.trim())
      .filter(Boolean);

    if (unitSplit.length <= 1) {
      const sentences = normalized
        .split(/(?<=[。！？!?\.])/)
        .map(item => item.trim())
        .filter(Boolean);
      return [{
        title: '整册教材',
        summary: sentences.slice(0, 3).join(' '),
        excerpt: sentences.slice(0, 3).join(' '),
        sentences,
        vocabulary: extractWordCandidates(text).slice(0, 6),
        practice: [
          '请概述本教材的核心主题。',
          '请列出该单元中 3 个关键法语词汇并解释。',
          '请根据教材内容写一句简短总结。',
        ],
      }];
    }

    return unitSplit.map(section => {
      const titleMatch = section.match(/^(?:第\s*\d+\s*单元|第\s*[一二三四五六七八九十]+\s*单元|单元\s*\d+|[Uu]nit[eé]\s*[IVXLCDM\d]+|Chapitre\s*\d+|章\s*\d+)/i);
      const title = titleMatch ? titleMatch[0] : '单元';
      const body = titleMatch ? section.slice(titleMatch[0].length).trim() : section;
      const sentences = body
        .split(/(?<=[。！？!?\.])/)
        .map(item => item.trim())
        .filter(Boolean);
      return {
        title,
        summary: sentences.slice(0, 3).join(' '),
        excerpt: sentences.slice(0, 3).join(' '),
        sentences,
        vocabulary: extractWordCandidates(body).slice(0, 6),
        practice: [
          `请翻译本单元第一句：“${sentences[0] ?? ''}”。`,
          '请列出本单元中的 3 个核心词汇并说明用法。',
          '请写一句与本单元主题相关的法语句子。',
        ],
      };
    });
  };

  const selectedUnit = useMemo(
    () => (materialPreview ? materialPreview.units[selectedUnitIndex] : null),
    [materialPreview, selectedUnitIndex]
  );

  const displayedSentences = useMemo(
    () => selectedUnit?.sentences ?? materialPreview?.sentences ?? [],
    [selectedUnit, materialPreview]
  );

  const sentenceCount = useMemo(() => displayedSentences.length, [displayedSentences]);

  const selectedSentence = useMemo(
    () => (selectedSentenceIndex !== null ? displayedSentences[selectedSentenceIndex] : null),
    [selectedSentenceIndex, displayedSentences]
  );

  const runDeepSeekAnalysis = async (sentence: string): Promise<AnalysisResult> => {
    const prompt = buildDeepSeekPrompt(sentence);
    setAnalysisPrompt(prompt);

    try {
      let data: any;
      const customEndpoint = resolveCustomEndpoint(deepSeekAnalyzeUrl, deepSeekApiUrl);
      if (customEndpoint) {
        const analyzeUrl = buildDeepSeekUrl(customEndpoint, 'analyze');
        const response = await fetch(analyzeUrl, {
          method: 'POST',
          headers: deepSeekHeaders,
          body: JSON.stringify({ sentence, prompt, source: pdfName }),
        });
        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(`DeepSeek Analyze API 返回 ${response.status}，请求 ${analyzeUrl}，响应：${responseText.slice(0, 320)}`);
        }
        data = await response.json();
      } else {
        const content = await callDeepSeekChat({ apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          '你是一个法语高级教育助手。请严格输出合法 JSON（不要用 markdown 代码块包裹），格式为：{"summary":"简要分析","grammarPoints":["语法点1","语法点2"],"commonMistakes":["常见错误1","常见错误2"]}。请使用中文解释。',
          buildDeepSeekPrompt(sentence)
        );
        data = extractJson(content);
      }
      return {
        summary: data.summary ?? 'DeepSeek 分析完成。',
        grammarPoints: data.grammarPoints ?? [],
        commonMistakes: data.commonMistakes ?? [],
      };
    } catch (error) {
      console.warn('DeepSeek 后端请求失败，使用本地模拟结果。', error);
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        summary: 'DeepSeek 模拟分析已完成。此结果为示例，后续可替换为真实 AI 返回内容。',
        grammarPoints: [
          '主句核心动词使用复合过去时，需注意助动词的 être/avoir 选择。',
          '从句使用关系代词/连接词时要保持主句与从句时态一致。',
          '情感类形容词通常在名词前后有细微语义差别，应结合语境判断。',
        ],
        commonMistakes: [
          '省略主句的主谓一致或谓语变位。',
          '错误使用简单过去时而非复合过去时。',
          '忽略重音符号导致词义混淆。',
        ],
      };
    }
  };


  const runPracticeGeneration = async (sentence: string): Promise<string[]> => {
    const prompt = buildPracticePrompt(sentence);
    setPracticePrompt(prompt);

    try {
      let data: any;
      const customEndpoint = resolveCustomEndpoint(deepSeekPracticeUrl, deepSeekApiUrl);
      if (customEndpoint) {
        const practiceUrl = buildDeepSeekUrl(customEndpoint, 'practice');
        const response = await fetch(practiceUrl, {
          method: 'POST',
          headers: deepSeekHeaders,
          body: JSON.stringify({ sentence, prompt, source: pdfName }),
        });
        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(`DeepSeek Practice API 返回 ${response.status}，请求 ${practiceUrl}，响应：${responseText.slice(0, 320)}`);
        }
        data = await response.json();
      } else {
        const content = await callDeepSeekChat({ apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          '你是一个法语学习助手，负责基于教材句子生成练习题。请严格输出合法 JSON（不要用 markdown 代码块包裹），格式为：{"questions":["题目1","题目2","题目3"]}。请输出 3 条适合中高级学习者的题目，使用中文题干。',
          buildPracticePrompt(sentence)
        );
        data = extractJson(content);
      }
      return data.questions ?? [];
    } catch (error) {
      console.warn('练习题生成失败，使用本地模拟结果。', error);
      await new Promise(resolve => setTimeout(resolve, 600));
      return [
        `请翻译句子：“${sentence}”。`,
        `指出该句中的高级词汇并说明它的 CEFR 等级。`,
        `根据句子写一句改写句，保持原意同时更自然。`,
      ];
    }
  };

  const handleSentenceSelect = (index: number) => {
    setSelectedSentenceIndex(index);
    setAnalysisResult(null);
    setAnalysisPrompt(null);
    setPracticeExercises([]);
    setPracticePrompt(null);
  };

  const handleUnitSelect = (index: number) => {
    setSelectedUnitIndex(index);
    setSelectedSentenceIndex(null);
    setAnalysisResult(null);
    setAnalysisPrompt(null);
    setPracticeExercises([]);
    setPracticePrompt(null);
  };

  const deepSeekModeLabel = useMemo(() => {
    const hasCustom =
      resolveCustomEndpoint(deepSeekParseUrl, deepSeekApiUrl) ||
      resolveCustomEndpoint(deepSeekAnalyzeUrl, deepSeekApiUrl) ||
      resolveCustomEndpoint(deepSeekPracticeUrl, deepSeekApiUrl);
    return hasCustom ? '自定义后端' : `官方 API（模型 ${deepSeekModel}）`;
  }, [deepSeekParseUrl, deepSeekAnalyzeUrl, deepSeekPracticeUrl, deepSeekApiUrl, deepSeekModel]);

  const testDeepSeekConnection = async () => {
    setDeepSeekTesting(true);
    setDeepSeekTestStatus('正在测试 DeepSeek 连接……');

    try {
      const customEndpoint = resolveCustomEndpoint(deepSeekParseUrl, deepSeekApiUrl);
      if (customEndpoint) {
        const url = buildDeepSeekUrl(customEndpoint, 'parse');
        const response = await fetch(url, {
          method: 'POST',
          headers: deepSeekHeaders,
          body: JSON.stringify({ text: 'Bonjour', prompt: buildParsePrompt('Bonjour'), source: pdfName }),
        });
        if (!response.ok) {
          const responseText = await response.text();
          throw new Error(`DeepSeek 连接测试返回 ${response.status}，请求 ${url}，响应：${responseText.slice(0, 320)}`);
        }
        const data = await response.json();
        setDeepSeekTestStatus(`DeepSeek 连接成功，返回字段：${Object.keys(data).join(', ')}`);
      } else {
        const content = await callDeepSeekChat({ apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          '你是连接测试助手。请只回复“连接成功”这四个字，不要输出其他内容。',
          '测试消息：Bonjour',
          32
        );
        setDeepSeekTestStatus(`DeepSeek 连接成功（模型 ${deepSeekModel}），回复：${content.slice(0, 100)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDeepSeekTestStatus(`DeepSeek 连接失败：${message}`);
    } finally {
      setDeepSeekTesting(false);
    }
  };

  const handleAnalyzeSentence = async () => {
    if (!selectedSentence) return;
    setLoading(true);

    try {
      const result = await runDeepSeekAnalysis(selectedSentence);
      setAnalysisResult(result);

      const record: AnalysisRecord = {
        sentence: selectedSentence,
        summary: result.summary,
        grammarPoints: result.grammarPoints,
        commonMistakes: result.commonMistakes,
        analyzedAt: new Date().toISOString(),
        promptPreview: result.debug?.promptPreview || analysisPrompt || undefined,
      };
      setAnalysisHistory(prev => [record, ...prev].slice(0, 12));
    } catch (e) {
      console.error(e);
      setAnalysisResult({
        summary: '分析失败，请检查网络或后端配置。',
        grammarPoints: [],
        commonMistakes: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePractice = async () => {
    if (!selectedSentence) return;
    setLoading(true);

    try {
      const questions = await runPracticeGeneration(selectedSentence);
      setPracticeExercises(questions);
      const record: AnalysisRecord = {
        sentence: selectedSentence,
        summary: `已生成 ${questions.length} 道练习题，适合复习当前句型。`,
        grammarPoints: [],
        commonMistakes: [],
        analyzedAt: new Date().toISOString(),
        promptPreview: practicePrompt || undefined,
        practiceExercises: questions,
      };
      setAnalysisHistory(prev => [record, ...prev].slice(0, 12));
    } catch (e) {
      console.error(e);
      setPracticeExercises([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWordBook = (candidate: WordCandidate) => {
    setWordBook(prev => {
      if (prev.some(item => item.text === candidate.text)) return prev;
      return [...prev, candidate];
    });
  };

  const handleDeleteHistory = (index: number) => {
    setAnalysisHistory(prev => prev.filter((_, idx) => idx !== index));
    if (expandedHistoryIndex === index) {
      setExpandedHistoryIndex(null);
    }
  };

  const handleClearHistory = () => {
    setAnalysisHistory([]);
    setExpandedHistoryIndex(null);
  };

  const handleExportHistory = () => {
    const blob = new Blob([JSON.stringify(analysisHistory, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'french-analysis-history.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleToggleHistory = (index: number) => {
    setExpandedHistoryIndex(prev => (prev === index ? null : index));
  };

  return (
    <div className="min-h-screen bg-cream text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="rounded-[32px] border border-slate-200 bg-white/95 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">🥐 法语 A2→C2 全阶段学习伴侣</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Bienvenue à Paris</h1>
              <p className="mt-3 max-w-2xl text-slate-600">暖色陪伴、优雅进阶，打造像在巴黎咖啡馆一样的私人学习体验。</p>
            </div>
            <div className="rounded-3xl bg-lavender/80 px-6 py-4 text-slate-900 shadow-inner shadow-slate-200">
              <p className="text-sm font-medium">学习气氛</p>
              <p className="mt-2 text-xl font-semibold">温暖活泼 · 轻松进阶</p>
            </div>
          </div>
        </header>

        <nav className="mt-8 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.05)] md:flex-row md:justify-between md:items-center">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('learn')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition shadow-sm ${
                activeTab === 'learn' ? 'bg-gradient-to-r from-warm to-coral text-white shadow-warm/25' : 'bg-white text-slate-700 hover:bg-cream'
              }`}
            >
              📚 通用学习
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition shadow-sm ${
                activeTab === 'materials' ? 'bg-lavender text-slate-900 shadow-slate-200' : 'bg-white text-slate-700 hover:bg-cream'
              }`}
            >
              📖 教材中心
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition shadow-sm ${
                activeTab === 'progress' ? 'bg-blush text-slate-900 shadow-slate-200' : 'bg-white text-slate-700 hover:bg-cream'
              }`}
            >
              📊 我的进度
            </button>
          </div>
          <p className="text-sm text-slate-500">Immerse yourself in French with cozy visuals and playful guidance.</p>
        </nav>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <h3 className="text-lg font-semibold text-slate-900">功能速览</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li>✨ A2→C2 全阶段学习框架</li>
              <li>🧠 词汇、语法、句型、写作、听力模块设计</li>
              <li>📚 支持 PDF 上传，自动提取与结构化解析</li>
              <li>🌟 轻松查看学习进度与复盘记录</li>
            </ul>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <h3 className="text-lg font-semibold text-slate-900">技术建议</h3>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
              <li>Supabase 用于用户、单词与练习资料存储。</li>
              <li>DeepSeek 负责语法解析、题目生成与写作辅助。</li>
              <li>Azure TTS 可实现逐句朗读与听力练习。</li>
              <li>后端可以承担 PDF 解析与结构化单元生成。</li>
            </ol>
          </div>
        </section>

        <main className="mt-8 space-y-8">
          <section className="space-y-8">
            <div className="rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.07)]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-coral">你好，法语学习者</p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900">{activeTab === 'learn' ? '通用学习系统' : activeTab === 'materials' ? '教材深度辅助' : '学习进度'}</h2>
                </div>
                <div className="rounded-3xl bg-sky/80 px-5 py-3 text-slate-900">{activeTab === 'learn' ? '🧠 进阶学习' : activeTab === 'materials' ? '📚 教材解析' : '📈 数据可视'}</div>
              </div>

              {activeTab === 'learn' && (
                <div className="grid gap-6 md:grid-cols-3">
                  <article className="rounded-[28px] bg-cream p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">单词学习 🔤</h3>
                    <p className="mt-3 text-sm text-slate-600">查词、收藏生词、测验与记忆回顾。</p>
                  </article>
                  <article className="rounded-[28px] bg-cream p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">语法专题 📖</h3>
                    <p className="mt-3 text-sm text-slate-600">按 A2→C2 递进的语法讲解与练习。</p>
                  </article>
                  <article className="rounded-[28px] bg-cream p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">听力 & 写作 🎧✍️</h3>
                    <p className="mt-3 text-sm text-slate-600">TTS 听力、写作批改、句型造句。</p>
                  </article>
                </div>
              )}

              {activeTab === 'materials' && (
                <div className="space-y-6">
                  <div className="rounded-[28px] bg-cream p-6 shadow-sm">
                    <p className="text-sm text-slate-600">当前支持 PDF 上传，后台可扩展为文件解析、分段朗读与 DeepSeek 深度分析。</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <p className="text-sm text-slate-500">已识别页数</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{materialPreview?.pages ?? '-'}</p>
                      </div>
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <p className="text-sm text-slate-500">提取句子</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{sentenceCount}</p>
                      </div>
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <p className="text-sm text-slate-500">解析模式</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900 capitalize">{parseMode === 'auto' ? '自动' : parseMode === 'deepseek' ? '强制 DeepSeek' : '本地解析'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-[28px] bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold text-slate-900">PDF 上传</h3>
                      <p className="mt-2 text-sm text-slate-600">上传教材后，系统会提取课文文本并为你生成结构化学习素材。</p>
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                          <p className="font-medium text-slate-900">解析模式</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setParseMode('auto')}
                              className={`rounded-2xl px-3 py-2 text-xs font-semibold ${parseMode === 'auto' ? 'bg-coral text-white' : 'bg-slate-100 text-slate-700'}`}
                            >
                              自动 DeepSeek
                            </button>
                            <button
                              type="button"
                              onClick={() => setParseMode('deepseek')}
                              className={`rounded-2xl px-3 py-2 text-xs font-semibold ${parseMode === 'deepseek' ? 'bg-coral text-white' : 'bg-slate-100 text-slate-700'}`}
                            >
                              强制 DeepSeek
                            </button>
                            <button
                              type="button"
                              onClick={() => setParseMode('local')}
                              className={`rounded-2xl px-3 py-2 text-xs font-semibold ${parseMode === 'local' ? 'bg-coral text-white' : 'bg-slate-100 text-slate-700'}`}
                            >
                              本地解析
                            </button>
                          </div>
                          <p className="mt-3 text-xs text-slate-500">“自动”模式优先使用 DeepSeek，失败后降级到本地解析。</p>
                          </div>
                        <details
                          className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                          open={deepSeekConfigOpen}
                          onToggle={() => setDeepSeekConfigOpen(prev => !prev)}
                        >
                          <summary className="cursor-pointer font-medium text-slate-900">DeepSeek 配置（点击展开 / 收起）</summary>
                          <div className="mt-4 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-[220px]">
                                <p className="font-medium text-slate-900">DeepSeek 配置</p>
                                <p className="mt-2 text-xs text-slate-500">直连官方 API：填 API Key + 选模型即可（走 /chat/completions）。如需自建后端，可再填下方自定义接口地址。</p>
                              </div>
                              <button
                                type="button"
                                onClick={testDeepSeekConnection}
                                disabled={deepSeekTesting || (!deepSeekApiKey && !deepSeekApiUrl)}
                                className="rounded-2xl bg-sky px-4 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
                              >
                                {deepSeekTesting ? '测试中...' : '测试 DeepSeek 连接'}
                              </button>
                            </div>
                            <div className="rounded-2xl border border-sky/40 bg-sky/10 p-3">
                              <p className="text-xs font-semibold text-slate-800">官方 API（默认）</p>
                              <div className="mt-3 grid gap-3">
                                <label className="flex flex-col gap-2 text-xs text-slate-600">
                                  API Key（必填）
                                  <input
                                    type="password"
                                    value={deepSeekApiKey}
                                    onChange={e => { setDeepSeekApiKey(e.target.value); setDeepSeekConfigSaved(false); }}
                                    placeholder="sk-..."
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky"
                                  />
                                </label>
                                <label className="flex flex-col gap-2 text-xs text-slate-600">
                                  模型
                                  <select
                                    value={deepSeekModel}
                                    onChange={e => { setDeepSeekModel(e.target.value); setDeepSeekConfigSaved(false); }}
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky"
                                  >
                                    <option value="deepseek-chat">deepseek-chat（通用对话，推荐）</option>
                                    <option value="deepseek-reasoner">deepseek-reasoner（深度推理）</option>
                                  </select>
                                </label>
                                <label className="flex flex-col gap-2 text-xs text-slate-600">
                                  官方 API 地址（可选）
                                  <input
                                    type="url"
                                    value={deepSeekOfficialUrl}
                                    onChange={e => { setDeepSeekOfficialUrl(e.target.value); setDeepSeekConfigSaved(false); }}
                                    placeholder="https://api.deepseek.com"
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky"
                                  />
                                </label>
                              </div>
                            </div>
                            <details className="rounded-2xl border border-slate-200 bg-white p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-slate-800">自定义后端接口（高级，可选）</summary>
                              <div className="mt-3 grid gap-3">
                                <label className="flex flex-col gap-2 text-xs text-slate-600">
                                  基础后端地址
                                  <input
                                    type="url"
                                    value={deepSeekApiUrl}
                                    onChange={e => { setDeepSeekApiUrl(e.target.value); setDeepSeekConfigSaved(false); }}
                                    placeholder="https://your-deepseek-endpoint.example.com"
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky"
                                  />
                                  <span className="text-xs text-slate-400">注意：若地址包含 deepseek.com（如 api.deepseek.com/anthropic），将自动按官方 API 处理，不再拼 /parse 等后缀。</span>
                                </label>
                                <label className="flex flex-col gap-2 text-xs text-slate-600">
                                  解析接口（可选）
                                  <input
                                    type="url"
                                    value={deepSeekParseUrl}
                                    onChange={e => { setDeepSeekParseUrl(e.target.value); setDeepSeekConfigSaved(false); }}
                                    placeholder="https://your-deepseek-endpoint.example.com/parse"
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky"
                                  />
                                </label>
                                <label className="flex flex-col gap-2 text-xs text-slate-600">
                                  分析接口（可选）
                                  <input
                                    type="url"
                                    value={deepSeekAnalyzeUrl}
                                    onChange={e => { setDeepSeekAnalyzeUrl(e.target.value); setDeepSeekConfigSaved(false); }}
                                    placeholder="https://your-deepseek-endpoint.example.com/analyze"
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky"
                                  />
                                </label>
                                <label className="flex flex-col gap-2 text-xs text-slate-600">
                                  练习接口（可选）
                                  <input
                                    type="url"
                                    value={deepSeekPracticeUrl}
                                    onChange={e => { setDeepSeekPracticeUrl(e.target.value); setDeepSeekConfigSaved(false); }}
                                    placeholder="https://your-deepseek-endpoint.example.com/practice"
                                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky"
                                  />
                                </label>
                                <p className="text-xs text-slate-500">填了自定义接口后，对应功能会优先走自定义端点；未填时默认使用官方 API。</p>
                              </div>
                            </details>
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() => { setDeepSeekConfigSaved(true); window.localStorage.setItem('deepseek-api-url', deepSeekApiUrl); window.localStorage.setItem('deepseek-parse-url', deepSeekParseUrl); window.localStorage.setItem('deepseek-analyze-url', deepSeekAnalyzeUrl); window.localStorage.setItem('deepseek-practice-url', deepSeekPracticeUrl); window.localStorage.setItem('deepseek-api-key', deepSeekApiKey); window.localStorage.setItem('deepseek-model', deepSeekModel); window.localStorage.setItem('deepseek-official-url', deepSeekOfficialUrl); }}
                                className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                              >
                                保存配置
                              </button>
                              <button
                                type="button"
                                onClick={() => { setDeepSeekApiUrl(''); setDeepSeekParseUrl(''); setDeepSeekAnalyzeUrl(''); setDeepSeekPracticeUrl(''); setDeepSeekApiKey(''); setDeepSeekConfigSaved(false); window.localStorage.removeItem('deepseek-api-url'); window.localStorage.removeItem('deepseek-parse-url'); window.localStorage.removeItem('deepseek-analyze-url'); window.localStorage.removeItem('deepseek-practice-url'); window.localStorage.removeItem('deepseek-api-key'); window.localStorage.removeItem('deepseek-model'); window.localStorage.removeItem('deepseek-official-url'); }}
                                className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                              >
                                清空配置
                              </button>
                              {deepSeekConfigSaved && (
                                <span className="text-xs text-slate-600">配置已保存至本地浏览器</span>
                              )}
                            </div>
                            <div className="rounded-2xl bg-white/80 p-3 text-xs text-slate-500">
                              <p>模式：{deepSeekModeLabel}</p>
                              <p>API Key：{deepSeekApiKey ? '已配置' : '未配置'}</p>
                              {deepSeekApiUrl && <p>基础后端地址：{deepSeekApiUrl}</p>}
                            </div>
                            {deepSeekTestStatus && (
                              <p className="text-xs text-slate-600">{deepSeekTestStatus}</p>
                            )}
                          </div>
                        </details>
                        <label className="block rounded-3xl border border-slate-200 bg-cream px-4 py-4">
                          <span className="text-sm text-slate-600">选择 PDF 文件</span>
                          <input type="file" accept="application/pdf" onChange={handleFileChange} className="mt-3 w-full cursor-pointer bg-transparent text-sm text-slate-900" />
                        </label>
                      </div>
                      {pdfName && <div className="mt-4 rounded-3xl bg-lavender/20 p-4 text-sm text-slate-700">已选择：<strong>{pdfName}</strong></div>}
                      {error && <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
                      {loading && <p className="mt-4 text-sm text-slate-600">正在提取，请稍候...</p>}
                    </div>

                    <div className="rounded-[28px] bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold text-slate-900">教材预览</h3>
                      <p className="mt-2 text-sm text-slate-600">提取后可直接查看文本段落，后续会追加逐句朗读和语法分析。</p>
                      <div className="mt-4 rounded-3xl bg-cream p-4 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">摘要</p>
                        <p className="mt-2 leading-7">{materialPreview?.excerpt || '目前尚未上传教材。'}</p>
                      </div>
                      <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">当前解析方法</p>
                        <p className="mt-2 leading-7">{parseMethod}</p>
                      </div>
                      {pdfText && (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => setShowFullText(prev => !prev)}
                            className="rounded-2xl bg-lavender px-4 py-2 text-sm font-semibold text-slate-900"
                          >
                            {showFullText ? '收起全文预览' : '展开全文预览'}
                          </button>
                          {showFullText && (
                            <div className="mt-4 max-h-64 overflow-auto rounded-3xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-700">
                              <pre className="whitespace-pre-wrap">{pdfText}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {materialPreview && (
                    <div className="rounded-[28px] bg-white p-6 shadow-sm">
                      <h3 className="text-xl font-semibold text-slate-900">教材句子与生词候选</h3>
                      <p className="mt-2 text-sm text-slate-600">从 PDF 中提取的关键句子和高频词汇，先预览词汇分级。</p>
                      <div className="mt-5 space-y-5">
                        {materialPreview.units.length > 1 && (
                          <div className="grid gap-2 sm:grid-cols-3">
                            {materialPreview.units.map((unit, index) => (
                              <button
                                key={`${unit.title}-${index}`}
                                type="button"
                                onClick={() => handleUnitSelect(index)}
                                className={`rounded-3xl px-4 py-3 text-sm font-medium transition ${
                                  selectedUnitIndex === index ? 'bg-coral text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-cream'
                                }`}
                              >
                                {unit.title}
                              </button>
                            ))}
                          </div>
                        )}
                        {selectedUnit && (
                          <div className="mt-6 rounded-[28px] bg-cream p-5 shadow-sm">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-slate-500">当前单元</p>
                                <h4 className="mt-2 text-xl font-semibold text-slate-900">{selectedUnit.title}</h4>
                              </div>
                              <span className="rounded-3xl bg-white px-4 py-2 text-sm text-slate-700">已选单元概览</span>
                            </div>
                            <div className="mt-5 grid gap-4 lg:grid-cols-3">
                              <UnitSummaryCard title={selectedUnit.title} summary={selectedUnit.summary} />
                              <UnitVocabularyCard vocabulary={selectedUnit.vocabulary} />
                              <UnitPracticeCard practice={selectedUnit.practice} />
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-900">课文句子</p>
                          <div className="mt-3 grid gap-3 max-h-56 overflow-auto">
                            {displayedSentences.slice(0, 8).map((sentence, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => handleSentenceSelect(index)}
                                className={`w-full rounded-3xl border px-4 py-3 text-left text-sm transition ${
                                  selectedSentenceIndex === index ? 'border-coral bg-coral/10 text-slate-900' : 'border-slate-200 bg-cream text-slate-700 hover:border-coral/70'
                                }`}
                              >
                                <span className="font-medium">句子 {index + 1}：</span>
                                <span>{sentence}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">生词候选</p>
                          <div className="mt-3 grid gap-3">
                            {candidateWords.length ? candidateWords.map(word => (
                              <div key={word.text} className="rounded-3xl border border-slate-200 bg-cream p-4 text-sm text-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-slate-900">{word.text}</p>
                                    <p className="mt-1 text-xs text-slate-500">{word.translation} · {word.cefr}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToWordBook(word)}
                                    className="rounded-2xl bg-coral px-3 py-1 text-xs font-semibold text-white"
                                  >
                                    收藏
                                  </button>
                                </div>
                              </div>
                            )) : (
                              <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">暂无词汇候选。上传教材后自动生成。</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'progress' && (
                <div className="space-y-6">
                  <div className="rounded-[28px] bg-cream p-6 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-600">进度模块已扩展为复盘中心，展示你的分析历史与词汇收藏成长。</p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleExportHistory}
                          className="rounded-2xl bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm"
                        >
                          导出历史
                        </button>
                        <button
                          type="button"
                          onClick={handleClearHistory}
                          className="rounded-2xl bg-rose-100 px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm"
                        >
                          清空历史
                        </button>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                      <div className="rounded-3xl bg-white p-4">
                        <p className="text-sm text-slate-500">已分析句数</p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">{analysisHistory.length}</p>
                      </div>
                      <div className="rounded-3xl bg-white p-4">
                        <p className="text-sm text-slate-500">生词收藏</p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">{wordBook.length}</p>
                      </div>
                      <div className="rounded-3xl bg-white p-4">
                        <p className="text-sm text-slate-500">复盘进度</p>
                        <p className="mt-3 text-3xl font-semibold text-slate-900">{Math.min(100, analysisHistory.length * 12)}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[28px] bg-white p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-slate-900">最近分析记录</h3>
                    <div className="mt-4 space-y-4">
                      {analysisHistory.length ? analysisHistory.slice(0, 6).map((record, index) => {
                        const isExpanded = expandedHistoryIndex === index;
                        return (
                          <div key={`${record.analyzedAt}-${index}`} className="rounded-3xl border border-slate-200 bg-cream p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">句子 {analysisHistory.length - index}</p>
                                <p className="mt-2 text-sm text-slate-700">{record.sentence}</p>
                                <p className="mt-2 text-xs text-slate-500">{new Date(record.analyzedAt).toLocaleString()}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleHistory(index)}
                                  className="rounded-2xl bg-lavender px-3 py-1 text-xs font-semibold text-slate-900"
                                >
                                  {isExpanded ? '收起详情' : '展开详情'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHistory(index)}
                                  className="rounded-2xl bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 text-sm text-slate-700">{record.summary}</div>
                            {isExpanded && (
                              <div className="mt-4 rounded-3xl bg-white p-4 text-sm text-slate-700">
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">语法亮点</p>
                                    <ul className="mt-2 list-disc space-y-2 pl-4">
                                      {record.grammarPoints.map((point, idx) => (
                                        <li key={idx}>{point}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">常见错误</p>
                                    <ul className="mt-2 list-disc space-y-2 pl-4">
                                      {record.commonMistakes.map((mistake, idx) => (
                                        <li key={idx}>{mistake}</li>
                                      ))}
                                    </ul>
                                  </div>
                                  {record.practiceExercises?.length ? (
                                    <div>
                                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">已生成练习题</p>
                                      <ul className="mt-2 list-decimal space-y-2 pl-4 text-sm text-slate-700">
                                        {record.practiceExercises.map((question, idx) => (
                                          <li key={idx}>{question}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                  {record.promptPreview && (
                                    <div>
                                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Prompt 预览</p>
                                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                        {record.promptPreview}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }) : (
                        <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">暂无分析记录，先在“教材中心”选择一道句子进行解析。</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>

        {activeTab === 'materials' && materialPreview && (
          <section className="mt-8 rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.07)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-slate-900">教材结构分析</h2>
                <p className="mt-2 text-sm text-slate-600">这是上传教材后的第一步展示。后续可扩展为逐句翻译、语法拆解与生词分级。</p>
              </div>
              <div className="rounded-3xl bg-blush/80 px-5 py-3 text-slate-900">📄 {materialPreview.title}</div>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl bg-cream p-5">
                <p className="text-sm text-slate-500">DeepSeek 拆分单元</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{materialPreview.units.length}</p>
              </div>
              <div className="rounded-3xl bg-cream p-5">
                <p className="text-sm text-slate-500">文本摘录</p>
                <p className="mt-3 text-slate-900 leading-7">{materialPreview.excerpt}</p>
              </div>
              <div className="rounded-3xl bg-cream p-5">
                <p className="text-sm text-slate-500">学习方式</p>
                <p className="mt-3 text-slate-700">按单元阅读、核心句法拆解、词汇造句、写作总结。</p>
              </div>
            </div>

            <div className="mt-6 rounded-[28px] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">DeepSeek 学习建议</h3>
                  <p className="mt-2 text-sm text-slate-600">基于拆分单元，这里是该教材的后续学习路径。</p>
                </div>
                <div className="rounded-3xl bg-slate-100 px-4 py-2 text-sm text-slate-700">
                  解析方式：{parseMethod}
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                {deepSeekStudyPlan.map((item, idx) => (
                  <p key={idx}>• {item}</p>
                ))}
              </div>

              {deepSeekParsePrompt && (
                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <p className="font-medium text-slate-900">DeepSeek 解析 Prompt</p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{deepSeekParsePrompt}</pre>
                </div>
              )}

              {deepSeekParseResponse && (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                  <p className="font-medium text-slate-900">DeepSeek 解析结果（JSON 预览）</p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{deepSeekParseResponse}</pre>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-[28px] bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">DeepSeek 拆分单元预览</h3>
              <p className="mt-2 text-sm text-slate-600">以下显示前几个解析到的单元标题与摘要，帮助你快速定位学习重点。</p>
              <div className="mt-4 space-y-4">
                {materialPreview.units.slice(0, 3).map((unit, idx) => (
                  <div key={idx} className="rounded-3xl border border-slate-200 bg-cream p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">单元 {idx + 1}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{unit.title}</p>
                    <p className="mt-3 text-sm text-slate-700">{unit.summary || '暂无摘要内容，建议先阅读本单元原文。'}</p>
                    {unit.vocabulary.length > 0 && (
                      <div className="mt-3 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">核心词汇</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {unit.vocabulary.slice(0, 4).map((word, wordIdx) => (
                            <span key={wordIdx} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{word.text}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-[28px] bg-cream p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-slate-900">选中句子分析</h3>
              <p className="mt-2 text-sm text-slate-600">点击句子后，查看该句的语法重点和常见错误提示。</p>
              <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-3xl bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-900">当前句子</p>
                  <div className="mt-3 min-h-[96px] rounded-3xl border border-slate-200 bg-cream p-4 text-sm leading-7 text-slate-700">
                    {selectedSentence || '请先从上方句子列表中选择一句进行分析。'}
                  </div>
                  {selectedSentence && (
                    <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">中文翻译预览</p>
                      <p className="mt-2 leading-7">{translateSentence(selectedSentence)}</p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      disabled={!selectedSentence || loading}
                      onClick={handleAnalyzeSentence}
                      className="rounded-2xl bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {loading ? '正在分析...' : '🔍 进行句法分析'}
                    </button>
                    <button
                      type="button"
                      disabled={!selectedSentence || loading}
                      onClick={handleGeneratePractice}
                      className="rounded-2xl bg-sky px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                    >
                      {loading ? '生成中...' : '✍️ 生成练习题'}
                    </button>
                  </div>
                  {practiceExercises.length > 0 && (
                    <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">练习题建议</p>
                      <ul className="mt-3 list-decimal space-y-2 pl-5">
                        {practiceExercises.map((question, idx) => (
                          <li key={idx}>{question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {practicePrompt && (
                    <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-xs text-slate-600">
                      <p className="font-medium text-slate-900">练习题生成 Prompt</p>
                      <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap">{practicePrompt}</pre>
                    </div>
                  )}
                  {analysisPrompt && (
                    <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-xs text-slate-600">
                      <p className="font-medium text-slate-900">DeepSeek 请求示例</p>
                      <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap">{analysisPrompt}</pre>
                    </div>
                  )}
                </div>
                <div className="rounded-3xl bg-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-slate-900">生词书</p>
                  <div className="mt-3 space-y-3">
                    {wordBook.length ? wordBook.map(word => (
                      <div key={word.text} className="rounded-3xl border border-slate-200 bg-cream p-3 text-sm text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{word.text}</p>
                            <p className="text-xs text-slate-500">{word.translation} · {word.cefr}</p>
                          </div>
                          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-600">×{word.frequency}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">当前生词本为空，点击“收藏”添加高频生词。</p>
                    )}
                  </div>
                </div>
              </div>

              {analysisResult && (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-sm font-medium text-slate-900">解析概览</p>
                      <p className="mt-3 text-sm text-slate-700">{analysisResult.summary}</p>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-slate-900">语法亮点</p>
                        <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-slate-700">
                          {analysisResult.grammarPoints.map((point, index) => (
                            <li key={index}>{point}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-3xl bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-slate-900">常见错误</p>
                        <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-slate-700">
                          {analysisResult.commonMistakes.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  {analysisResult.debug && (
                    <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 shadow-sm">
                      <p className="font-medium text-slate-900">DeepSeek Debug 信息</p>
                      <div className="mt-3 space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">句子</p>
                          <p className="mt-1 text-sm text-slate-700">{analysisResult.debug.sentence}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Prompt 预览</p>
                          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                            {analysisResult.debug.promptPreview}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
