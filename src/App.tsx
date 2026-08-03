import { useEffect, useMemo, useState } from 'react';
import './App.css';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { UnitPracticeCard } from './components/UnitPracticeCard';
import { buildDeepSeekPrompt, buildParsePrompt, buildPracticePrompt, buildDeepSeekUrl,
  callDeepSeekChat, extractJson, isOfficialDeepSeekUrl, resolveCustomEndpoint } from './lib/deepseek';
import type { AnalysisRecord, AnalysisResult, GrammarExercise, MaterialPreview, TabKey, UnitSection, WordCandidate } from './types';
import { LearnTab } from './tabs/LearnTab';
import { PathTab } from './tabs/PathTab';

/** 无 DeepSeek Key 时的离线语法练习兜底 */
const STATIC_GRAMMAR: Record<string, GrammarExercise[]> = {
  A2: [
    { question: 'Hier, je ___ (manger) une pizza.（用复合过去时填空）', answer: "j'ai mangé" },
    { question: 'Tu veux du thé ? ___ tu veux un café ?（用 est-ce que 提问）', answer: 'Est-ce que' },
    { question: 'Ce livre est ___ (intéressant) que celui-là.（比较级）', answer: 'plus intéressant' },
  ],
  B1: [
    { question: "Si j'avais le temps, je ___ (voyager) plus.（条件式现在时）", answer: 'voyagerais' },
    { question: "Il faut que tu ___ (faire) tes devoirs.（虚拟式）", answer: 'fasses' },
    { question: 'La femme ___ habite ici est médecin.（关系代词）', answer: 'qui' },
  ],
  B2: [
    { question: "Je doute qu'il ___ (venir) demain.（虚拟式）", answer: 'vienne' },
    { question: 'Ce projet ___ (construire) par une équipe jeune.（被动语态）', answer: 'a été construit' },
    { question: "Il m'a dit qu'il ___ (être) en retard.（间接引语）", answer: 'était / avait été' },
  ],
  C1: [
    { question: 'Il ___ (pleuvoir) depuis trois jours quand nous sommes arrivés.（愈过去时）', answer: 'avait plu' },
    { question: 'Bien que ___ (être) fatigué, il a continué.（省略句）', answer: 'fatigué' },
    { question: "Sans ton aide, je n'___ pas ___ (réussir).（条件式过去时）", answer: 'aurais pas réussi' },
  ],
  C2: [
    { question: "Traduisez : « Il n'y a pas de fumée sans feu. »（习语）", answer: "无风不起浪" },
    { question: 'Transformez au registre soutenu : « Il est super fort en maths. »', answer: 'Il excelle en mathématiques.' },
    { question: "Faites l'hypothèse : S'il avait écouté mes conseils, il ___ (éviter) cette erreur.", answer: 'aurait évité' },
  ],
};


import { MaterialsTab } from './tabs/MaterialsTab';
import { ProgressTab } from './tabs/ProgressTab';
import { UnitSummaryCard } from './components/UnitSummaryCard';
import { UnitVocabularyCard } from './components/UnitVocabularyCard';

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('materials');
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfTargetPage, setPdfTargetPage] = useState<number | null>(null);
  const [pdfJumpSignal, setPdfJumpSignal] = useState(0);
  const [translationResult, setTranslationResult] = useState<string | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [wordDetailResult, setWordDetailResult] = useState<string | null>(null);
  const [wordDetailLoading, setWordDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialPreview, setMaterialPreview] = useState<MaterialPreview | null>(null);
  const [candidateWords, setCandidateWords] = useState<WordCandidate[]>([]);
  const [wordBook, setWordBook] = useState<WordCandidate[]>([]);
  const [flashcardMastery, setFlashcardMastery] = useState<Record<string, number>>({});
  const [writingResult, setWritingResult] = useState<string | null>(null);
  const [writingLoading, setWritingLoading] = useState(false);
  const [grammarExercises, setGrammarExercises] = useState<GrammarExercise[] | null>(null);
  const [grammarLoading, setGrammarLoading] = useState(false);
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
    const savedMastery = window.localStorage.getItem('french-flashcard-mastery');
    if (savedMastery) {
      try {
        setFlashcardMastery(JSON.parse(savedMastery));
      } catch (error) {
        console.warn('加载闪卡熟练度失败：', error);
      }
    }
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
    window.localStorage.setItem('french-flashcard-mastery', JSON.stringify(flashcardMastery));
  }, [flashcardMastery]);

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
    setMaterialPreview(null);
    setLoading(true);

    const isPdfFile = file.type.toLowerCase().includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdfFile) {
      setError('当前仅支持 PDF 文件上传。');
      setLoading(false);
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const { fullText, pages, pdfDoc } = await extractTextFromPdf(arrayBuffer);
      const preview = buildMaterialPreview(fullText);
      const units = await parsePdfUnits(fullText);
      const unitsWithPages = mapUnitsToPages(units, pages);
      const candidates = extractWordCandidates(fullText);
      setPdfDoc(pdfDoc);
      setPdfPages(pages);
      setMaterialPreview({ ...preview, units: unitsWithPages });
      setSelectedUnitIndex(0);
      setPdfTargetPage(unitsWithPages[0]?.startPage ?? null);
      setPdfJumpSignal(signal => signal + 1);
      setCandidateWords(candidates);
    } catch (e) {
      console.error('PDF 提取失败：', e);
      const message = e instanceof Error ? e.message : String(e);
      setError(`PDF 文本提取失败，请稍后再试。${message ? ` 错误：${message}` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer) => {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf');
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    const loadingTask = getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => ('str' in item ? item.str : '')).join(' ');
      pages.push(pageText.trim());
    }
    const fullText = pages.map((pageText, index) => `\n\n第 ${index + 1} 页:\n${pageText}`).join('').trim();
    return { fullText, pages, pdfDoc: pdf };
  };

  /** 根据每页文本，把单元映射到对应 PDF 页码（用于预览框自动跳页）。
   *  策略：① 单元前 3 句全文精确匹配（本地解析的逐字文本可跨页命中）；
   *        ② 失败时按标题定位：跳过目录/索引页（含 ≥2 个单元标题的页（目录/索引页）），
   *           取标题首次出现在正文单元页的位置（兼容 DeepSeek 改写的句子）。 */
  const mapUnitsToPages = (units: UnitSection[], pages: string[]): UnitSection[] => {
    const normPages = pages.map(page => page.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[’‘]/g, "'"));
    const normStarts: number[] = [];
    const pieces: string[] = [];
    let pos = 0;
    normPages.forEach((pageText, index) => {
      const marker = `第 ${index + 1} 页:`;
      if (index > 0) pos += 1;
      pos += marker.length;
      pieces.push(marker);
      pos += 1;
      normStarts.push(pos);
      pieces.push(pageText);
      pos += pageText.length;
    });
    const normFull = pieces.join(' ');
    const pageForOffset = (offset: number) => {
      let page = 1;
      for (let p = 0; p < normStarts.length; p += 1) {
        if (normStarts[p] <= offset) page = p + 1;
        else break;
      }
      return page;
    };

    // 标题 → 出现页列表；含 ≥3 个不同标题的页视为目录/索引页（页号存负数标记）
    const titleKeys = Array.from(new Set(
      units.map(u => (u.title || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[’‘]/g, "'")).filter(Boolean)
    ));
    const titlePages = new Map<string, number[]>();
    normPages.forEach((pageText, index) => {
      const present: string[] = [];
      for (const key of titleKeys) {
        if (pageText.includes(key)) {
          present.push(key);
          const list = titlePages.get(key) || [];
          list.push(index + 1);
          titlePages.set(key, list);
        }
      }
      if (present.length >= 2) {
        for (const key of present) {
          const list = titlePages.get(key)!;
          list[list.length - 1] = -Math.abs(list[list.length - 1]);
        }
      }
    });

    // 目录/索引页：页内出现大量 "p. XX" 引用（教材正文页通常为 0），匹配时需跳过
    const tocPages = new Set<number>();
    normPages.forEach((pageText, index) => {
      const refs = (pageText.match(/p\.\s*\d+/g) || []).length;
      if (refs >= 5) tocPages.add(index + 1);
    });

    let searchFrom = 0;
    let prevStartPage = 1;
    return units.map(unit => {
      // ① 精确匹配：只用句子（统一小写 + 弯引号归一，兼容 DeepSeek 改写）；命中目录/索引页时继续向后找正文页
      let startPage = -1;
      for (const sentence of unit.sentences.slice(0, 3)) {
        const key = sentence.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[’‘]/g, "'");
        if (key.length < 8) continue;
        let from = searchFrom;
        for (;;) {
          const idx = normFull.indexOf(key, from);
          if (idx < 0) break;
          const pg = pageForOffset(idx);
          if (!tocPages.has(pg)) {
            startPage = pg;
            searchFrom = idx + 1;
            break;
          }
          from = idx + 1;
        }
        if (startPage >= 0) break;
      }

      // ② 标题定位：先按完整标题，再退而求其次去掉 "Unité N" 前缀用副标题关键词定位
      if (startPage < 0 && unit.title) {
        const key = unit.title.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[’‘]/g, "'");
        const pagesList = titlePages.get(key) || [];
        const firstReal = pagesList.find(pg => pg > 0);
        if (firstReal && firstReal > 0) {
          startPage = firstReal;
        } else {
          const subtitle = key.replace(/^unit[eé]\s*\d+\s*[:.\-–]?\s*/, '').trim();
          if (subtitle.length >= 4) {
            for (let p = 0; p < normPages.length; p += 1) {
              if (tocPages.has(p + 1)) continue;
              if (normPages[p].includes(subtitle)) {
                startPage = p + 1;
                break;
              }
            }
          }
        }
      }

      const finalPage = startPage > 0 ? startPage : prevStartPage;
      prevStartPage = finalPage;
      return { ...unit, startPage: finalPage, endPage: finalPage };
    });
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
    const unit = materialPreview?.units[index];
    if (unit?.startPage) {
      setPdfTargetPage(unit.startPage);
      setPdfJumpSignal(signal => signal + 1);
    }
  };

  /** 课程路径：课时「课文精读」→ 切到教材中心并跳转 PDF 到单元起始页 */
  const handleOpenUnitFromPath = (index: number) => {
    setSelectedUnitIndex(index);
    setSelectedSentenceIndex(null);
    setAnalysisResult(null);
    setAnalysisPrompt(null);
    setPracticeExercises([]);
    setPracticePrompt(null);
    const unit = materialPreview?.units[index];
    if (unit?.startPage) {
      setPdfTargetPage(unit.startPage);
      setPdfJumpSignal(signal => signal + 1);
    }
    setActiveTab('materials');
  };

  /** 课程路径：课时「语法要点」→ 切到通用学习并生成对应等级/单元语法题 */
  const handleStartGrammarFromPath = (level: string, topic: string) => {
    setActiveTab('learn');
    void runGrammarExercise(level, topic);
  };

  /** 课程路径：课时「核心词汇」→ 把单元词汇并入生词本（去重），返回新增数量 */
  const handleAddUnitWordsFromPath = (unitIndex: number): number => {
    const unit = materialPreview?.units[unitIndex];
    if (!unit?.vocabulary?.length) return 0;
    const existing = new Set(wordBook.map(w => w.text));
    const fresh = unit.vocabulary.filter(w => w.text && !existing.has(w.text));
    if (fresh.length) {
      setWordBook(prev => {
        const prevSet = new Set(prev.map(w => w.text));
        const toAdd = fresh.filter(w => !prevSet.has(w.text));
        return [...prev, ...toAdd];
      });
    }
    return fresh.length;
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

  const runAnalysisAndRecord = async (sentence: string) => {
    setLoading(true);
    try {
      const result = await runDeepSeekAnalysis(sentence);
      setAnalysisResult(result);

      const record: AnalysisRecord = {
        sentence,
        summary: result.summary,
        grammarPoints: result.grammarPoints,
        commonMistakes: result.commonMistakes,
        analyzedAt: new Date().toISOString(),
        promptPreview: result.debug?.promptPreview || undefined,
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

  const handleAnalyzeSentence = async () => {
    if (!selectedSentence) return;
    await runAnalysisAndRecord(selectedSentence);
  };

  const runSelectedTextAnalysis = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await runAnalysisAndRecord(trimmed);
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

  const runSelectedTextTranslation = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTranslationLoading(true);
    setTranslationResult(null);
    try {
      if (deepSeekApiKey) {
        const content = await callDeepSeekChat({ apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          '你是一位法语翻译助手。请把用户输入的法语内容翻译成准确自然的中文；若输入是中文则翻译成法语。只输出译文，不要额外解释。',
          trimmed,
          1024
        );
        setTranslationResult(content.trim());
      } else {
        setTranslationResult(`（本地词典逐词翻译）${translateSentence(trimmed)}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setTranslationResult(`翻译失败：${message}。已回退到本地逐词翻译：${translateSentence(trimmed)}`);
    } finally {
      setTranslationLoading(false);
    }
  };

  const runSelectedWordDetail = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const word = trimmed.split(/\s+/)[0].replace(/[^a-zàâçéèêëîïôûùüÿæœ]/gi, '').toLowerCase() || trimmed;
    setWordDetailLoading(true);
    setWordDetailResult(null);
    try {
      if (deepSeekApiKey) {
        const content = await callDeepSeekChat({ apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          '你是一位法语词汇专家。请用中文详细解释用户给出的法语单词或短语：词性、中文释义、1-2 个用法例句、CEFR 等级建议。',
          `词汇：${trimmed}`,
          1024
        );
        setWordDetailResult(content.trim());
      } else {
        const local = translateWord(word);
        const detail = local === '待补充'
          ? '本地词典暂无释义。配置 DeepSeek API Key 后可获得完整详解（词性、例句、CEFR）。'
          : local;
        setWordDetailResult(`${word}：${detail}（本地词典）`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setWordDetailResult(`单词详解失败：${message}`);
    } finally {
      setWordDetailLoading(false);
    }
  };

  const handleAddSelectedWord = (text: string) => {
    const word = text.trim().split(/\s+/)[0].replace(/[^a-zàâçéèêëîïôûùüÿæœ]/gi, '').toLowerCase();
    if (!word) return;
    handleAddToWordBook({
      text: word,
      cefr: getCeFrTag(word),
      translation: translateWord(word),
      frequency: 1,
    });
  };

  const runWritingCorrection = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setWritingLoading(true);
    setWritingResult(null);
    try {
      if (deepSeekApiKey) {
        const content = await callDeepSeekChat({ apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          '你是一位法语写作老师。请批改用户的法语作文：先给整体评价，再逐条列出错误（原文 → 修改 → 原因），最后给出改进建议。用中文解释。',
          trimmed,
          2048
        );
        setWritingResult(content.trim());
      } else {
        setWritingResult('⚠️ 当前未配置 DeepSeek API Key。可在「教材中心 → DeepSeek 配置」中填写后获得专业批改（语法、用词、表达建议）。');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setWritingResult(`批改失败：${message}`);
    } finally {
      setWritingLoading(false);
    }
  };

  const runGrammarExercise = async (level: string, topic: string) => {
    setGrammarLoading(true);
    setGrammarExercises(null);
    try {
      if (deepSeekApiKey) {
        const content = await callDeepSeekChat({ apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          `你是一位法语语法老师。请针对 CEFR ${level} 级别、主题「${topic}」，生成 3 道法语练习题（中文题干，留空作答）。严格输出合法 JSON（不要用 markdown 代码块包裹），格式为：{"questions":[{"question":"题目","answer":"参考答案"}]}。`,
          `级别：${level}，主题：${topic}`,
          2048
        );
        const data = extractJson(content);
        const questions = Array.isArray(data?.questions) ? data.questions : [];
        setGrammarExercises(questions.slice(0, 5).map((q: any) => ({
          question: String(q?.question ?? ''),
          answer: String(q?.answer ?? ''),
        })));
      } else {
        setGrammarExercises(STATIC_GRAMMAR[level] || []);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setGrammarExercises([{ question: `生成失败：${message}（可在「教材中心 → DeepSeek 配置」填写 API Key）`, answer: '' }]);
    } finally {
      setGrammarLoading(false);
    }
  };

  const handleFlashcardMasteryChange = (word: string, delta: number) => {
    setFlashcardMastery(prev => {
      const current = prev[word] ?? 0;
      const next = Math.max(0, Math.min(5, current + delta));
      return { ...prev, [word]: next };
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
              onClick={() => setActiveTab('path')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition shadow-sm ${
                activeTab === 'path' ? 'bg-gradient-to-r from-warm to-coral text-white shadow-warm/25' : 'bg-white text-slate-700 hover:bg-cream'
              }`}
            >
              🗺️ 课程路径
            </button>
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
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900">{activeTab === 'path' ? '分级课程路径' : activeTab === 'learn' ? '通用学习系统' : activeTab === 'materials' ? '教材深度辅助' : '学习进度'}</h2>
                </div>
                <div className="rounded-3xl bg-sky/80 px-5 py-3 text-slate-900">{activeTab === 'path' ? '🗺️ 分级课程' : activeTab === 'learn' ? '🧠 进阶学习' : activeTab === 'materials' ? '📚 教材解析' : '📈 数据可视'}</div>
              </div>

{activeTab === 'path' && (
    <PathTab
      materialPreview={materialPreview}
      pdfName={pdfName}
      onOpenUnitInPdf={handleOpenUnitFromPath}
      onStartGrammar={handleStartGrammarFromPath}
      onAddUnitWords={handleAddUnitWordsFromPath}
      onGoMaterials={() => setActiveTab('materials')}
      onGoLearn={() => setActiveTab('learn')}
    />
  )}

{activeTab === 'learn' && (
    <LearnTab
      wordBook={wordBook}
      flashcardMastery={flashcardMastery}
      onFlashcardMasteryChange={handleFlashcardMasteryChange}
      writingLoading={writingLoading}
      writingResult={writingResult}
      onWritingCorrection={runWritingCorrection}
      grammarLoading={grammarLoading}
      grammarExercises={grammarExercises}
      onGrammarGenerate={runGrammarExercise}
    />
  )}

{activeTab === 'materials' && (
    <MaterialsTab
      pdfName={ pdfName }
      error={ error }
      loading={ loading }
      parseMethod={ parseMethod }
      parseMode={ parseMode }
      setParseMode={ setParseMode }
      materialPreview={ materialPreview }
      selectedUnit={ selectedUnit }
      selectedUnitIndex={ selectedUnitIndex }
      displayedSentences={ displayedSentences }
      sentenceCount={ sentenceCount }
      selectedSentence={ selectedSentence }
      selectedSentenceIndex={ selectedSentenceIndex }
      candidateWords={ candidateWords }
      wordBook={ wordBook }
      deepSeekStudyPlan={ deepSeekStudyPlan }
      deepSeekModeLabel={ deepSeekModeLabel }
      analysisResult={ analysisResult }
      analysisPrompt={ analysisPrompt }
      practiceExercises={ practiceExercises }
      practicePrompt={ practicePrompt }
      deepSeekParsePrompt={ deepSeekParsePrompt }
      deepSeekParseResponse={ deepSeekParseResponse }
      deepSeekTestStatus={ deepSeekTestStatus }
      deepSeekTesting={ deepSeekTesting }
      deepSeekApiKey={ deepSeekApiKey }
      setDeepSeekApiKey={ setDeepSeekApiKey }
      deepSeekModel={ deepSeekModel }
      setDeepSeekModel={ setDeepSeekModel }
      deepSeekOfficialUrl={ deepSeekOfficialUrl }
      setDeepSeekOfficialUrl={ setDeepSeekOfficialUrl }
      deepSeekApiUrl={ deepSeekApiUrl }
      setDeepSeekApiUrl={ setDeepSeekApiUrl }
      deepSeekParseUrl={ deepSeekParseUrl }
      setDeepSeekParseUrl={ setDeepSeekParseUrl }
      deepSeekAnalyzeUrl={ deepSeekAnalyzeUrl }
      setDeepSeekAnalyzeUrl={ setDeepSeekAnalyzeUrl }
      deepSeekPracticeUrl={ deepSeekPracticeUrl }
      setDeepSeekPracticeUrl={ setDeepSeekPracticeUrl }
      deepSeekConfigSaved={ deepSeekConfigSaved }
      setDeepSeekConfigSaved={ setDeepSeekConfigSaved }
      deepSeekConfigOpen={ deepSeekConfigOpen }
      setDeepSeekConfigOpen={ setDeepSeekConfigOpen }
      handleFileChange={ handleFileChange }
      handleUnitSelect={ handleUnitSelect }
      pdfDoc={ pdfDoc }
      pdfTargetPage={ pdfTargetPage }
      pdfJumpSignal={ pdfJumpSignal }
      onTranslateText={ runSelectedTextTranslation }
      onAnalyzeText={ runSelectedTextAnalysis }
      onWordDetail={ runSelectedWordDetail }
      onAddWord={ handleAddSelectedWord }
      translationResult={ translationResult }
      translationLoading={ translationLoading }
      wordDetailResult={ wordDetailResult }
      wordDetailLoading={ wordDetailLoading }
      handleSentenceSelect={ handleSentenceSelect }
      handleAddToWordBook={ handleAddToWordBook }
      handleAnalyzeSentence={ handleAnalyzeSentence }
      handleGeneratePractice={ handleGeneratePractice }
      testDeepSeekConnection={ testDeepSeekConnection }
      translateSentence={ translateSentence }
    />
  )}

{activeTab === 'progress' && (
    <ProgressTab
      analysisHistory={analysisHistory}
      wordBook={wordBook}
      expandedHistoryIndex={expandedHistoryIndex}
      handleToggleHistory={handleToggleHistory}
      handleDeleteHistory={handleDeleteHistory}
      handleClearHistory={handleClearHistory}
      handleExportHistory={handleExportHistory}
    />
  )}
            </div>
          </section>
        </main>

      </div>
    </div>
  );
}

export default App;