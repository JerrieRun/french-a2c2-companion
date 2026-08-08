import { useEffect, useMemo, useState } from 'react';
import './App.css';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { UnitPracticeCard } from './components/UnitPracticeCard';
import { buildDeepSeekPrompt, buildParsePrompt, buildPracticePrompt, buildUnitModulePrompt, buildUnitPracticePrompt, buildDeepSeekUrl,
  callDeepSeekChat, extractJson, isOfficialDeepSeekUrl, resolveCustomEndpoint } from './lib/deepseek';
import { clearPdfFile, clearPreview, loadPdfFile, loadPreview, savePdfFile, savePreview, saveTextbookMarkdown, loadTextbookMarkdown, clearTextbookMarkdown } from './lib/storage';
import { pdfToMarkdown, extractMarkdownRange } from './lib/pdfToMarkdown';
import { compressPdf } from './lib/pdfCompress';
import { buildLocalPractice, detectLevel, normalizePractice } from './lib/unitPractice';
import type { AnalysisRecord, AnalysisResult, FlashcardSrs, GrammarExercise, IntensiveAnalysis, MaterialPreview, PathProgress, TabKey, UnitSection, WordCandidate, WordLookupResult } from './types';
import { createSrs, gradeSrs } from './lib/srs';
import type { SrsGrade } from './lib/srs';
import { LearnTab } from './tabs/LearnTab';
import { PathTab } from './tabs/PathTab';
import { AuthModal } from './components/AuthModal';
import { downloadTextbookMarkdown, downloadTextbookMeta, downloadTextbookPdf, fetchAllUserData, getCurrentUser, hasTextbook, pushUserData, signInWithEmail, signOut, signUpWithEmail, supabaseConfigured, SYNC_KEYS, uploadTextbookMarkdown, uploadTextbookMeta, uploadTextbookPdf } from './lib/supabase';
import type { SupabaseUser, SyncKey } from './lib/supabase';

/** 无 DeepSeek Key 时的离线语法练习兜底 */
/** 解析 CSV 行（支持双引号包裹与转义） */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',' || ch === '\t') {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

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
  // Markdown 精读
  const [readerMode, setReaderMode] = useState<'pdf' | 'md'>('pdf');
  const [textbookMarkdown, setTextbookMarkdown] = useState<string | null>(null);
  const [mdStatus, setMdStatus] = useState<'idle' | 'generating' | 'ready' | 'error'>('idle');
  const [mdProgress, setMdProgress] = useState<{ done: number; total: number } | null>(null);
  const [mdError, setMdError] = useState<string | null>(null);
  const [mdSource, setMdSource] = useState<'auto' | 'imported' | null>(null);
  const [translationResult, setTranslationResult] = useState<string | null>(null);
  // 精析（翻译 + 句型精析合并）
  const [intensiveResult, setIntensiveResult] = useState<IntensiveAnalysis | null>(null);
  const [intensiveLoading, setIntensiveLoading] = useState(false);
  // 点击查词
  const [wordLookup, setWordLookup] = useState<WordLookupResult | null>(null);
  const [wordLookupLoading, setWordLookupLoading] = useState(false);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [wordDetailResult, setWordDetailResult] = useState<string | null>(null);
  const [wordDetailLoading, setWordDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialPreview, setMaterialPreview] = useState<MaterialPreview | null>(null);
  const [candidateWords, setCandidateWords] = useState<WordCandidate[]>([]);
  const [wordBook, setWordBook] = useState<WordCandidate[]>([]);
  const [flashcardMastery, setFlashcardMastery] = useState<Record<string, number>>({});
  // 闪卡间隔重复（SM-2）
  const [flashcardSrs, setFlashcardSrs] = useState<Record<string, FlashcardSrs>>({});
  const [writingResult, setWritingResult] = useState<string | null>(null);
  const [writingPrompt, setWritingPrompt] = useState<string | null>(null);
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
  const [unitModuleLoading, setUnitModuleLoading] = useState<number | null>(null);
  const [practiceLoading, setPracticeLoading] = useState<number | null>(null);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  /* ---- 云端登录与同步 ---- */
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'off' | 'syncing' | 'synced' | 'error'>('off');
  // 教材云端同步状态（PDF + Markdown 上传 Supabase Storage）
  const [textbookSync, setTextbookSync] = useState<'off' | 'syncing' | 'synced' | 'error'>('off');
  // 大文件自动压缩
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState<{ done: number; total: number } | null>(null);
  const [compressResult, setCompressResult] = useState<string | null>(null);
  const [pathProgress, setPathProgress] = useState<PathProgress>(() => {
    try {
      return JSON.parse(window.localStorage.getItem('french-path-progress') || '{}') as PathProgress;
    } catch {
      return {};
    }
  });

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
    const savedSrs = window.localStorage.getItem('french-flashcard-srs');
    if (savedSrs) {
      try {
        setFlashcardSrs(JSON.parse(savedSrs));
      } catch (error) {
        console.warn('加载闪卡间隔重复数据失败：', error);
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
    void restoreSavedMaterial();
  }, []);

  /** 启动时恢复 Supabase 登录态，登录后拉取云端记录到本地 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseConfigured) {
        setAuthLoading(false);
        return;
      }
      try {
        const user = await getCurrentUser();
        if (cancelled) return;
        setAuthUser(user);
        if (user) {
          await applyCloudToLocal();
          void restoreTextbookFromCloud(user);
        }
      } catch (e) {
        console.warn('恢复登录状态失败：', e);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 云端优先：登录时把云端记录写回本地；本地有而云端没有的则上传 */
  const applyCloudToLocal = async () => {
    setSyncStatus('syncing');
    try {
      const cloud = await fetchAllUserData();
      for (const key of SYNC_KEYS) {
        const value = cloud[key];
        if (value !== undefined) {
          window.localStorage.setItem(key, JSON.stringify(value));
          switch (key) {
            case 'french-word-book':
              setWordBook(value as WordCandidate[]);
              break;
            case 'french-flashcard-mastery':
              setFlashcardMastery(value as Record<string, number>);
              break;
            case 'french-flashcard-srs':
              setFlashcardSrs(value as Record<string, FlashcardSrs>);
              break;
            case 'french-analysis-history':
              setAnalysisHistory(value as AnalysisRecord[]);
              break;
            case 'french-path-progress':
              setPathProgress(value as PathProgress);
              break;
            case 'french-preview':
              setMaterialPreview(value as MaterialPreview);
              break;
          }
        } else {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            try {
              await pushUserData(key, JSON.parse(raw));
            } catch {
              // 单条上传失败不阻断整体流程
            }
          }
        }
      }
      setSyncStatus('synced');
    } catch (e) {
      console.warn('云端数据拉取失败：', e);
      setSyncStatus('error');
    }
  };

  /** 把本地教材上传到当前用户云端（PDF + 原始文件名） */
  const uploadTextbookToCloud = async (user: SupabaseUser, pdf: ArrayBuffer, fileName: string) => {
    try {
      setTextbookSync('syncing');
      await uploadTextbookPdf(user.id, pdf, fileName);
      try { await uploadTextbookMeta(user.id, fileName); } catch { /* 元数据失败不影响主文件 */ }
      setTextbookSync('synced');
    } catch (e) {
      console.warn('教材上传云端失败：', e);
      setTextbookSync('error');
    }
  };

  /** 把精读 Markdown 上传到云端（供跨设备直接精读，无需重新转换） */
  const uploadMarkdownToCloud = async (user: SupabaseUser, markdown: string) => {
    try {
      await uploadTextbookMarkdown(user.id, markdown);
    } catch (e) {
      console.warn('Markdown 上传云端失败：', e);
    }
  };

  /** 登录后尝试从云端恢复教材（本地已有则跳过） */
  const restoreTextbookFromCloud = async (user: SupabaseUser) => {
    try {
      const has = await hasTextbook(user.id);
      if (!has.pdf) return;
      const saved = await loadPdfFile();
      if (saved) return; // 本机已有教材，以本地为准
      setTextbookSync('syncing');
      const pdf = await downloadTextbookPdf(user.id);
      if (!pdf) return;
      const metaName = await downloadTextbookMeta(user.id);
      await savePdfFile(metaName || pdf.fileName, pdf.data);
      const md = await downloadTextbookMarkdown(user.id);
      if (md) await saveTextbookMarkdown(md);
      await restoreSavedMaterial();
      setTextbookSync('synced');
    } catch (e) {
      console.warn('从云端恢复教材失败：', e);
      setTextbookSync('error');
    }
  };

  /** 登录 / 注册提交 */
  const handleAuthSubmit = async (email: string, password: string, mode: 'login' | 'signup') => {
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const user = mode === 'login' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password);
      setAuthUser(user);
      setAuthModalOpen(false);
      await applyCloudToLocal();
      void restoreTextbookFromCloud(user);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuthSubmitting(false);
    }
  };

  /** 登出：清本地会话与状态 */
  const handleLogout = async () => {
    await signOut();
    setAuthUser(null);
    setSyncStatus('off');
    setTextbookSync('off');
  };

  /** 路径进度持久化到本地 */
  useEffect(() => {
    window.localStorage.setItem('french-path-progress', JSON.stringify(pathProgress));
  }, [pathProgress]);

  /** 已登录时，学习记录变化后防抖上传云端 */
  useEffect(() => {
    if (!authUser) return;
    setSyncStatus('syncing');
    const t = setTimeout(() => {
      void pushUserData('french-word-book', wordBook)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [wordBook, authUser]);
  useEffect(() => {
    if (!authUser) return;
    setSyncStatus('syncing');
    const t = setTimeout(() => {
      void pushUserData('french-flashcard-mastery', flashcardMastery)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [flashcardMastery, authUser]);
  useEffect(() => {
    if (!authUser) return;
    setSyncStatus('syncing');
    const t = setTimeout(() => {
      void pushUserData('french-flashcard-srs', flashcardSrs)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [flashcardSrs, authUser]);
  useEffect(() => {
    if (!authUser) return;
    setSyncStatus('syncing');
    const t = setTimeout(() => {
      void pushUserData('french-analysis-history', analysisHistory)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [analysisHistory, authUser]);
  useEffect(() => {
    if (!authUser) return;
    setSyncStatus('syncing');
    const t = setTimeout(() => {
      void pushUserData('french-path-progress', pathProgress)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [pathProgress, authUser]);
  useEffect(() => {
    if (!authUser || !materialPreview) return;
    setSyncStatus('syncing');
    const t = setTimeout(() => {
      void pushUserData('french-preview', materialPreview)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }, 800);
    return () => clearTimeout(t);
  }, [materialPreview, authUser]);

  useEffect(() => {
    if (materialPreview) savePreview(materialPreview);
  }, [materialPreview]);

  useEffect(() => {
    window.localStorage.setItem('french-word-book', JSON.stringify(wordBook));
  }, [wordBook]);
  useEffect(() => {
    window.localStorage.setItem('french-flashcard-mastery', JSON.stringify(flashcardMastery));
  }, [flashcardMastery]);
  useEffect(() => {
    window.localStorage.setItem('french-flashcard-srs', JSON.stringify(flashcardSrs));
  }, [flashcardSrs]);

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

  /** 启动时恢复上次上传并保存的教材（IndexedDB 存 PDF + localStorage 存解析结果），无需重新上传 */
  const restoreSavedMaterial = async () => {
    try {
      const saved = await loadPdfFile();
      const preview = loadPreview();
      if (!saved || !preview) return;
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf');
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const pdf = await getDocument({ data: saved.data }).promise;
      setPdfName(saved.name);
      setPdfDoc(pdf);
      setMaterialPreview(preview);
      // 后台预生成 Markdown 精读文本（有缓存则直接读取）
      void generateTextbookMarkdown(pdf);
      setSelectedUnitIndex(0);
      setCandidateWords(extractWordCandidates(preview.units.map(u => u.sentences.join(' ')).join(' ')));
      setRestoreNotice(`✅ 已自动恢复上次上传的教材《${saved.name}》，无需重新上传。`);
    } catch (e) {
      console.warn('恢复已保存教材失败：', e);
    }
  };

  /** 把教材转成 Markdown 精读文本：优先读缓存，否则逐页本地转换 */
  const generateTextbookMarkdown = async (pdf: PDFDocumentProxy | null = pdfDoc) => {
    if (!pdf) return;
    if (mdStatus === 'generating') return;
    try {
      const cached = await loadTextbookMarkdown();
      if (cached) {
        setTextbookMarkdown(cached);
        setMdStatus('ready');
        setMdSource(prev => prev ?? 'auto');
        return;
      }
    } catch (e) {
      console.warn('读取 Markdown 缓存失败：', e);
    }
    setMdStatus('generating');
    setMdProgress(null);
    setMdError(null);
    try {
      const md = await pdfToMarkdown(pdf, (done, total) => setMdProgress({ done, total }));
      setTextbookMarkdown(md);
      setMdStatus('ready');
      setMdSource('auto');
      try {
        await saveTextbookMarkdown(md);
      } catch (e) {
        console.warn('缓存 Markdown 失败：', e);
      }
      if (authUser && md) void uploadMarkdownToCloud(authUser, md);
    } catch (e) {
      console.error('Markdown 生成失败：', e);
      setMdStatus('error');
      setMdError(e instanceof Error ? e.message : String(e));
    } finally {
      setMdProgress(null);
    }
  };

  /** 导入外部 .md（如微软 MarkItDown 本地转换结果） */
  const handleImportMarkdown = async (text: string, _name?: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setTextbookMarkdown(trimmed);
    setMdStatus('ready');
    setMdSource('imported');
    setMdError(null);
    try {
      await saveTextbookMarkdown(trimmed);
    } catch (e) {
      console.warn('缓存导入的 Markdown 失败：', e);
    }
  };

  /** 从 Markdown 精读跳回 PDF 原页对应页 */
  const handleJumpToPdfPage = (page: number) => {
    setReaderMode('pdf');
    setPdfTargetPage(page);
    setPdfJumpSignal(signal => signal + 1);
  };

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
      let arrayBuffer = await file.arrayBuffer();
      // 超过阈值自动压缩（渲染压缩 + 隐形文字层），便于上传 Supabase（免费额度 50MB）
      if (arrayBuffer.byteLength > 45 * 1024 * 1024) {
        setCompressing(true);
        setCompressProgress({ done: 0, total: 0 });
        setCompressResult(null);
        try {
          const originalSize = arrayBuffer.byteLength; // pdf.js 可能 detach 原 buffer，先记录
          const compressed = await compressPdf(arrayBuffer, (done, total) => setCompressProgress({ done, total }));
          const before = (originalSize / 1048576).toFixed(0);
          const after = (compressed.byteLength / 1048576).toFixed(1);
          arrayBuffer = compressed;
          setCompressResult(`🗜️ 已自动压缩：${before}MB → ${after}MB（文字层已保留，精读/查词不受影响）`);
        } catch (e) {
          console.error('PDF 自动压缩失败，改用原文件：', e);
          setCompressResult(null);
        } finally {
          setCompressing(false);
          setCompressProgress(null);
        }
      }
      // pdfjs 可能 detach 原始 buffer，先复制一份用于本地保存
      const pdfStorageCopy = arrayBuffer.slice(0);
      const { fullText, pages, pdfDoc } = await extractTextFromPdf(arrayBuffer);
      const preview = buildMaterialPreview(fullText);
      const units = await parsePdfUnits(fullText);
      const unitsWithPages = mapUnitsToPages(units, pages);
      const candidates = extractWordCandidates(fullText);
      setPdfDoc(pdfDoc);
      setPdfPages(pages);
      // 重置 Markdown 精读（换新教材后旧缓存/旧内容一律作废），并后台重新生成
      setTextbookMarkdown(null);
      setMdStatus('idle');
      setMdProgress(null);
      setMdError(null);
      setMdSource(null);
      setReaderMode('pdf');
      try {
        await clearTextbookMarkdown();
      } catch (e) {
        console.warn('清除旧 Markdown 缓存失败：', e);
      }
      void generateTextbookMarkdown(pdfDoc);
      const fullPreview = { ...preview, units: unitsWithPages };
      setMaterialPreview(fullPreview);
      setSelectedUnitIndex(0);
      setPdfTargetPage(unitsWithPages[0]?.startPage ?? null);
      setPdfJumpSignal(signal => signal + 1);
      setCandidateWords(candidates);
      try {
        // 保存到本地：PDF 入 IndexedDB、解析结果入 localStorage，之后无需重新上传
        await savePdfFile(file.name, pdfStorageCopy);
        savePreview(fullPreview);
        // 已登录时把教材同步到云端（跨设备恢复）
        if (authUser) void uploadTextbookToCloud(authUser, pdfStorageCopy, file.name);
        setRestoreNotice(`✅ 教材《${file.name}》已保存在本项目中，下次打开自动恢复，无需重新上传。`);
      } catch (saveErr) {
        console.warn('保存教材到本地失败：', saveErr);
      }
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

    return [
      `共 ${units.length} 个单元：先在「单元目录」浏览每单元主题、页码与核心词汇，确定学习顺序。`,
      '每个单元：先读摘要和核心词汇 → 用「教材原页预览」精读课文 → 展开「详细学习卡」复习词汇 / 语法 / 常见错误 / 例句。',
      '学完一个单元后，到「课程路径」完成对应课时的词汇、句型、语法、练习与闪卡复习。',
      '把不熟的词加入生词本，之后用「单词闪卡」定期复习巩固。',
    ];
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

  /** 课程路径：课时「句型精析」→ 切到教材中心并分析该单元第一个核心句子 */
  const handleAnalyzeUnitSentenceFromPath = async (unitIndex: number) => {
    const unit = materialPreview?.units[unitIndex];
    const sentence = unit?.sentences?.find(s => s.trim().length > 8) || unit?.sentences?.[0];
    if (!sentence) return;
    setSelectedUnitIndex(unitIndex);
    setSelectedSentenceIndex(0);
    setActiveTab('materials');
    await runAnalysisAndRecord(sentence);
  };

  /** 课程路径：课时「写作复述」→ 预填写作题目并切到通用学习 */
  const handleWritingPromptFromPath = (prompt: string) => {
    setWritingPrompt(prompt);
    setActiveTab('learn');
  };

  /** 生成单个单元的「详细学习卡」（分类词汇/语法精华/常见错误/中法例句），结果合并进 materialPreview */
  const generateUnitModule = async (unitIndex: number) => {
    const unit = materialPreview?.units[unitIndex];
    if (!unit) return;
    if (unit.vocabGroups || unit.grammarTopics || unit.exampleSentences) return;
    setUnitModuleLoading(unitIndex);
    try {
      if (!deepSeekApiKey) {
        // 无 API Key：本地兜底，仅生成词汇分组
        setMaterialPreview(prev => prev ? {
          ...prev,
          units: prev.units.map((u, i) => i === unitIndex ? ({
            ...u,
            vocabGroups: u.vocabulary.length ? [{ category: '本单元核心词汇', items: u.vocabulary.map(v => ({ word: v.text, translation: v.translation })) }] : [],
          }) : u),
        } : prev);
        return;
      }
      const mdExcerpt = textbookMarkdown && unit.startPage
        ? extractMarkdownRange(textbookMarkdown, unit.startPage, unit.endPage)
        : '';
      const content = await callDeepSeekChat(
        { apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
        '你是一位资深法语教师（CEFR A2→C2），负责为教材单元生成详细学习卡，讲解用中文。',
        buildUnitModulePrompt(unit.title, unit.summary, unit.sentences, mdExcerpt || undefined),
        8192
      );
      const data = extractJson(content);
      const norm = (arr: unknown) => (Array.isArray(arr) ? arr : []);
      setMaterialPreview(prev => prev ? {
        ...prev,
        units: prev.units.map((u, i) => i === unitIndex ? ({
          ...u,
          vocabGroups: norm(data?.vocabGroups).map((g: any) => ({
            category: String(g?.category ?? ''),
            items: norm(g?.items).map((it: any) => ({
              word: String(it?.word ?? ''),
              translation: String(it?.translation ?? ''),
              example: it?.example ? String(it.example) : undefined,
            })).filter((it: { word: string }) => it.word),
          })).filter((g: { category: string; items: unknown[] }) => g.category && g.items.length),
          grammarTopics: norm(data?.grammarTopics).map((t: any) => ({
            title: String(t?.title ?? ''),
            explanation: String(t?.explanation ?? ''),
            table: Array.isArray(t?.table) && t.table.length > 1 ? t.table.map((row: unknown) => Array.isArray(row) ? row.map((c: unknown) => String(c ?? '')) : []) : undefined,
          })).filter((t: { title: string }) => t.title),
          commonMistakes: norm(data?.commonMistakes).map((m: any) => ({
            wrong: String(m?.wrong ?? ''),
            right: String(m?.right ?? ''),
            note: m?.note ? String(m.note) : undefined,
          })).filter((m: { wrong: string; right: string }) => m.wrong && m.right),
          exampleSentences: norm(data?.exampleSentences).map((s: any) => ({
            zh: String(s?.zh ?? ''),
            fr: String(s?.fr ?? ''),
          })).filter((s: { zh: string; fr: string }) => s.zh && s.fr),
        }) : u),
      } : prev);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setMaterialPreview(prev => prev ? {
        ...prev,
        units: prev.units.map((u, i) => i === unitIndex ? ({
          ...u,
          exampleSentences: [{ zh: '⚠️ 生成失败', fr: message }],
        }) : u),
      } : prev);
    } finally {
      setUnitModuleLoading(null);
    }
  };

  /** 生成单元「全题型练习」：DeepSeek 按考级题型生成，无 Key 时用本地模板兜底 */
  const generateUnitPractice = async (unitIndex: number) => {
    const unit = materialPreview?.units[unitIndex];
    if (!unit || practiceLoading === unitIndex || unit.practiceSections) return;
    setPracticeLoading(unitIndex);
    try {
      let practice;
      if (deepSeekApiKey) {
        const mdExcerpt = textbookMarkdown && unit.startPage
          ? extractMarkdownRange(textbookMarkdown, unit.startPage, unit.endPage)
          : '';
        const content = await callDeepSeekChat(
          { apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          '你是一位资深法语考级出题教师（DELF/DALF/TCF），负责为教材单元生成覆盖全部题型的单元练习，讲解用中文。',
          buildUnitPracticePrompt({
            unitTitle: unit.title,
            summary: unit.summary,
            level: detectLevel(pdfName),
            excerpt: mdExcerpt || unit.sentences.join(' '),
            vocab: unit.vocabulary.slice(0, 15).map(v => `${v.text}（${v.translation}）`),
            grammarTitles: (unit.grammarTopics ?? []).map(t => t.title),
          }),
          8192
        );
        const normalized = normalizePractice(extractJson(content));
        const hasAny = !!(normalized.listening || normalized.reading || normalized.grammar || normalized.cloze
          || normalized.vocabulary || normalized.ordering || normalized.correction || normalized.writing || normalized.oral);
        practice = hasAny ? normalized : buildLocalPractice(unit);
      } else {
        practice = buildLocalPractice(unit);
      }
      setMaterialPreview(prev => prev ? {
        ...prev,
        units: prev.units.map((u, i) => i === unitIndex ? ({ ...u, practiceSections: practice }) : u),
      } : prev);
    } catch (e) {
      console.error('单元练习生成失败，使用本地模板：', e);
      const practice = buildLocalPractice(unit);
      setMaterialPreview(prev => prev ? {
        ...prev,
        units: prev.units.map((u, i) => i === unitIndex ? ({ ...u, practiceSections: practice }) : u),
      } : prev);
    } finally {
      setPracticeLoading(null);
    }
  };

  /** 清除本地保存的教材（PDF + 解析结果），恢复为空状态 */
  const handleClearSavedMaterial = async () => {
    try {
      await clearPdfFile();
      clearPreview();
      await clearTextbookMarkdown();
    } catch (e) {
      console.warn('清除本地教材失败：', e);
    }
    setPdfName(null);
    setPdfDoc(null);
    setMaterialPreview(null);
    setCandidateWords([]);
    setRestoreNotice(null);
    setTextbookMarkdown(null);
    setMdStatus('idle');
    setMdProgress(null);
    setMdError(null);
    setMdSource(null);
    setReaderMode('pdf');
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

  /** 精读「精析」：先中文翻译，再按句型精析格式输出（分析此句 + 语法亮点 + 常见错误） */
  const runIntensiveAnalysis = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIntensiveLoading(true);
    setIntensiveResult(null);
    try {
      let translation: string;
      if (deepSeekApiKey) {
        try {
          translation = (await callDeepSeekChat(
            { apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
            '你是一位法语翻译助手。请把用户输入的法语内容翻译成准确自然的中文；若输入是中文则翻译成法语。只输出译文，不要额外解释。',
            trimmed,
            1024
          )).trim();
        } catch {
          translation = `（本地逐词翻译）${translateSentence(trimmed)}`;
        }
      } else {
        translation = `（本地逐词翻译）${translateSentence(trimmed)}`;
      }
      const analysis = await runDeepSeekAnalysis(trimmed);
      setIntensiveResult({
        sentence: trimmed,
        translation,
        summary: analysis.summary,
        grammarPoints: analysis.grammarPoints,
        commonMistakes: analysis.commonMistakes,
      });
      const record: AnalysisRecord = {
        sentence: trimmed,
        summary: analysis.summary,
        grammarPoints: analysis.grammarPoints,
        commonMistakes: analysis.commonMistakes,
        analyzedAt: new Date().toISOString(),
        promptPreview: analysis.debug?.promptPreview,
      };
      setAnalysisHistory(prev => [record, ...prev].slice(0, 12));
    } catch (e) {
      console.error('精析失败：', e);
      setIntensiveResult({
        sentence: trimmed,
        translation: '（翻译失败）',
        summary: '分析失败，请检查网络或后端配置。',
        grammarPoints: [],
        commonMistakes: [],
      });
    } finally {
      setIntensiveLoading(false);
    }
  };

  const handleCloseIntensive = () => setIntensiveResult(null);

  /** 点击查词：简洁释义（贴合文义置顶）+ 常用搭配 + 动词变位 */
  const lookupWord = async (word: string, context?: string) => {
    const trimmed = word.trim().replace(/[.,;:!?«»""'']+$/g, '');
    if (!trimmed) return;
    setWordLookupLoading(true);
    setWordLookup(null);
    try {
      if (deepSeekApiKey) {
        const content = await callDeepSeekChat(
          { apiKey: deepSeekApiKey, officialUrl: deepSeekOfficialUrl, model: deepSeekModel },
          '你是一位法语词汇专家。请用中文给出单词的简洁易懂释义（一句话一条，最多 3 条），并把「最贴合给定上下文」的释义放在最前面；同时列出常用搭配 2-5 个；如果该词是动词，请给出常见时态变位（présent / passé composé / imparfait / futur simple 至少四个时态，每个时态列出 je/tu/il-elle/nous/vous/ils-elles 六个人称）。严格输出合法 JSON（不要用 markdown 代码块包裹）：{"defs":["释义1（最贴近上下文）","释义2"],"collocations":["搭配1","搭配2"],"isVerb":true/false,"conjugation":[{"tense":"présent","forms":["je ...","tu ...",...]},...]}。非动词时 conjugation 为空数组。',
          `单词：${trimmed}\n上下文：${context || '（无上下文）'}`,
          2048
        );
        const data = extractJson(content);
        const defs = Array.isArray(data?.defs) ? data.defs.map((d: unknown) => String(d)).filter(Boolean) : [];
        const collocations = Array.isArray(data?.collocations) ? data.collocations.map((c: unknown) => String(c)).filter(Boolean) : [];
        const conjugation = Array.isArray(data?.conjugation)
          ? data.conjugation
              .map((t: any) => ({ tense: String(t?.tense ?? ''), forms: Array.isArray(t?.forms) ? t.forms.map((f: unknown) => String(f)).filter(Boolean) : [] }))
              .filter((t: { tense: string; forms: unknown[] }) => t.tense && t.forms.length)
          : [];
        setWordLookup({
          word: trimmed,
          defs: defs.length ? defs : ['（未能生成释义）'],
          collocations,
          isVerb: !!data?.isVerb,
          conjugation,
        });
      } else {
        const local = translateWord(trimmed.toLowerCase());
        setWordLookup({
          word: trimmed,
          defs: local === '待补充' ? [`「${trimmed}」本地词典暂无释义，配置 DeepSeek API Key 后可获取完整释义。`] : [local],
          collocations: [],
          isVerb: false,
          conjugation: [],
        });
      }
    } catch (e) {
      console.error('查词失败：', e);
      const local = translateWord(trimmed.toLowerCase());
      setWordLookup({
        word: trimmed,
        defs: [local === '待补充' ? '（查词失败，请检查网络或后端配置）' : local],
        collocations: [],
        isVerb: false,
        conjugation: [],
      });
    } finally {
      setWordLookupLoading(false);
    }
  };

  const handleCloseWordLookup = () => setWordLookup(null);

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

  /** 闪卡间隔重复：SM-2 更新 + 同步旧熟练度（兼容旧数据） */
  const handleSrsReview = (word: string, grade: SrsGrade) => {
    const w = wordBook.find(x => x.text === word);
    setFlashcardSrs(prev => {
      const cur = prev[word] ?? createSrs(word, w?.translation ?? '待补充', w?.cefr ?? 'B2');
      const next = gradeSrs(cur, grade);
      setFlashcardMastery(m => ({ ...m, [word]: next.mastery }));
      return { ...prev, [word]: next };
    });
  };

  /** 导出生词本（CSV） */
  const handleExportWordBook = () => {
    if (!wordBook.length) return;
    const rows = [['word', 'translation', 'cefr', 'frequency'],
      ...wordBook.map(w => [w.text, w.translation, w.cefr, String(w.frequency)])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '生词本.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  /** 导入生词本（CSV/文本），按词去重合并 */
  const handleImportWordBook = (text: string, _fileName: string) => {
    const items: WordCandidate[] = [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const cells = parseCsvLine(line);
      const word = (cells[0] || '').trim();
      if (!word) continue;
      if (['word', '单词', 'text', '法语'].includes(word.toLowerCase())) continue; // 表头
      const cefrRaw = (cells[2] || '').trim().toUpperCase();
      items.push({
        text: word,
        translation: (cells[1] || '').trim() || '待补充',
        cefr: (['A2', 'B1', 'B2', 'C1', 'C2'].includes(cefrRaw) ? cefrRaw : 'B2') as WordCandidate['cefr'],
        frequency: parseInt(cells[3] || '1', 10) || 1,
      });
    }
    if (!items.length) return;
    setWordBook(prev => {
      const seen = new Set(prev.map(w => w.text.toLowerCase()));
      const merged = [...prev];
      for (const it of items) {
        if (!seen.has(it.text.toLowerCase())) {
          seen.add(it.text.toLowerCase());
          merged.push(it);
        }
      }
      return merged;
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
          <div className="flex flex-col items-start gap-3 md:items-end">
            <div className="flex flex-wrap items-center gap-3">
              {authLoading ? (
                <span className="text-xs text-slate-400">正在恢复登录…</span>
              ) : authUser ? (
                <>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-50 text-emerald-700'
                        : syncStatus === 'syncing'
                          ? 'bg-sky-50 text-sky-700'
                          : syncStatus === 'error'
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {syncStatus === 'synced' ? '☁️ 已同步' : syncStatus === 'syncing' ? '☁️ 同步中…' : syncStatus === 'error' ? '⚠️ 同步失败' : '☁️ 待同步'}
                  </span>
                  <span className="max-w-[200px] truncate text-sm text-slate-600">{authUser.email}</span>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    退出
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="rounded-2xl bg-coral px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                >
                  ☁️ 登录 / 注册
                </button>
              )}
            </div>
            <p className="text-sm text-slate-500">Immerse yourself in French with cozy visuals and playful guidance.</p>
          </div>
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
      hasApiKey={!!deepSeekApiKey}
      onOpenUnitInPdf={handleOpenUnitFromPath}
      onAddUnitWords={handleAddUnitWordsFromPath}
      onGoMaterials={() => setActiveTab('materials')}
      onGoLearn={() => setActiveTab('learn')}
      onGenerateUnitModule={generateUnitModule}
      unitModuleLoading={unitModuleLoading}
      onAnalyzeSentence={runDeepSeekAnalysis}
      onGeneratePractice={generateUnitPractice}
      practiceLoading={practiceLoading}
      progress={pathProgress}
      onToggleProgress={(unit, lesson) => {
        setPathProgress(prev => {
          const next = { ...prev };
          const key = `${unit}:${lesson}`;
          if (next[key]) delete next[key];
          else next[key] = true;
          return next;
        });
      }}
    />
  )}

{activeTab === 'learn' && (
    <LearnTab
      wordBook={wordBook}
      flashcardSrs={flashcardSrs}
      onSrsReview={handleSrsReview}
      onExportWordBook={handleExportWordBook}
      onImportWordBook={handleImportWordBook}
      writingLoading={writingLoading}
      writingResult={writingResult}
      writingPrompt={writingPrompt}
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
      onIntensiveAnalyze={ runIntensiveAnalysis }
      onAddWord={ handleAddSelectedWord }
      handleSentenceSelect={ handleSentenceSelect }
      handleAddToWordBook={ handleAddToWordBook }
      handleAnalyzeSentence={ handleAnalyzeSentence }
      onGenerateUnitModule={ generateUnitModule }
      unitModuleLoading={ unitModuleLoading }
      restoreNotice={ restoreNotice }
      onDismissRestoreNotice={ () => setRestoreNotice(null) }
      onClearSavedMaterial={ handleClearSavedMaterial }
      readerMode={ readerMode }
      setReaderMode={ setReaderMode }
      textbookMarkdown={ textbookMarkdown }
      mdStatus={ mdStatus }
      mdProgress={ mdProgress }
      mdError={ mdError }
      mdSource={ mdSource }
      onGenerateMarkdown={ () => void generateTextbookMarkdown() }
      onImportMarkdown={ handleImportMarkdown }
      onJumpToPdfPage={ handleJumpToPdfPage }
      intensiveResult={ intensiveResult }
      intensiveLoading={ intensiveLoading }
      onCloseIntensive={ handleCloseIntensive }
      wordLookup={ wordLookup }
      wordLookupLoading={ wordLookupLoading }
      onLookupWord={ lookupWord }
      onCloseWordLookup={ handleCloseWordLookup }
      textbookSync={ textbookSync }
      compressing={ compressing }
      compressProgress={ compressProgress }
      compressResult={ compressResult }
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
          <AuthModal
            open={authModalOpen}
            mode={authMode}
            onModeChange={setAuthMode}
            onSubmit={handleAuthSubmit}
            submitting={authSubmitting}
            error={authError}
            onClose={() => setAuthModalOpen(false)}
          />
        </main>

      </div>
    </div>
  );
}

export default App;