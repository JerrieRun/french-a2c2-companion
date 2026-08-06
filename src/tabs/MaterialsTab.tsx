import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PdfViewer } from '../components/PdfViewer';
import { MarkdownReader } from '../components/MarkdownReader';
import { UnitSummaryCard } from '../components/UnitSummaryCard';
import { UnitStudyModule } from '../components/UnitStudyModule';
import type { AnalysisResult, MaterialPreview, UnitSection, WordCandidate } from '../types';

type ParseMode = 'auto' | 'deepseek' | 'local';

type MaterialsTabProps = {
  // 教材与解析状态
  pdfName: string | null;
  error: string | null;
  loading: boolean;
  parseMethod: string;
  parseMode: ParseMode;
  setParseMode: (mode: ParseMode) => void;
  materialPreview: MaterialPreview | null;
  selectedUnit: UnitSection | null;
  selectedUnitIndex: number;
  displayedSentences: string[];
  sentenceCount: number;
  selectedSentence: string | null;
  selectedSentenceIndex: number | null;
  candidateWords: WordCandidate[];
  wordBook: WordCandidate[];
  // DeepSeek 相关
  deepSeekStudyPlan: string[];
  deepSeekModeLabel: string;
  analysisResult: AnalysisResult | null;
  analysisPrompt: string | null;
  practiceExercises: string[];
  practicePrompt: string | null;
  deepSeekParsePrompt: string | null;
  deepSeekParseResponse: string | null;
  deepSeekTestStatus: string | null;
  deepSeekTesting: boolean;
  deepSeekApiKey: string;
  setDeepSeekApiKey: (value: string) => void;
  deepSeekModel: string;
  setDeepSeekModel: (value: string) => void;
  deepSeekOfficialUrl: string;
  setDeepSeekOfficialUrl: (value: string) => void;
  deepSeekApiUrl: string;
  setDeepSeekApiUrl: (value: string) => void;
  deepSeekParseUrl: string;
  setDeepSeekParseUrl: (value: string) => void;
  deepSeekAnalyzeUrl: string;
  setDeepSeekAnalyzeUrl: (value: string) => void;
  deepSeekPracticeUrl: string;
  setDeepSeekPracticeUrl: (value: string) => void;
  deepSeekConfigSaved: boolean;
  setDeepSeekConfigSaved: (value: boolean) => void;
  deepSeekConfigOpen: boolean;
  setDeepSeekConfigOpen: (updater: (prev: boolean) => boolean) => void;
  // 事件处理
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  // PDF 原页预览（划线选择）
  pdfDoc: PDFDocumentProxy | null;
  pdfTargetPage: number | null;
  pdfJumpSignal: number;
  onTranslateText: (text: string) => Promise<void>;
  onAnalyzeText: (text: string) => Promise<void>;
  onWordDetail: (text: string) => Promise<void>;
  onAddWord: (text: string) => void;
  translationResult: string | null;
  translationLoading: boolean;
  wordDetailResult: string | null;
  wordDetailLoading: boolean;
  handleUnitSelect: (index: number) => void;
  handleSentenceSelect: (index: number) => void;
  handleAddToWordBook: (candidate: WordCandidate) => void;
  handleAnalyzeSentence: () => Promise<void>;
  handleGeneratePractice: () => Promise<void>;
  testDeepSeekConnection: () => Promise<void>;
  translateSentence: (sentence: string) => string;
  // 单元详细学习卡 + 本地保存
  onGenerateUnitModule: (unitIndex: number) => Promise<void>;
  unitModuleLoading: number | null;
  restoreNotice: string | null;
  onDismissRestoreNotice: () => void;
  onClearSavedMaterial: () => Promise<void>;
  // Markdown 精读
  readerMode: 'pdf' | 'md';
  setReaderMode: (mode: 'pdf' | 'md') => void;
  textbookMarkdown: string | null;
  mdStatus: 'idle' | 'generating' | 'ready' | 'error';
  mdProgress: { done: number; total: number } | null;
  mdError: string | null;
  mdSource: 'auto' | 'imported' | null;
  onGenerateMarkdown: () => void;
  onImportMarkdown: (text: string, name?: string) => Promise<void>;
  onJumpToPdfPage: (page: number) => void;
};

export function MaterialsTab(props: MaterialsTabProps) {
  const {
    pdfName, error, loading, parseMethod, parseMode, setParseMode,
    materialPreview, selectedUnit, selectedUnitIndex,
    sentenceCount, selectedSentence,
    wordBook, deepSeekStudyPlan, deepSeekModeLabel,
    analysisResult, analysisPrompt, practiceExercises, practicePrompt,
    deepSeekParsePrompt, deepSeekParseResponse, deepSeekTestStatus, deepSeekTesting,
    deepSeekApiKey, setDeepSeekApiKey, deepSeekModel, setDeepSeekModel,
    deepSeekOfficialUrl, setDeepSeekOfficialUrl, deepSeekApiUrl, setDeepSeekApiUrl,
    deepSeekParseUrl, setDeepSeekParseUrl, deepSeekAnalyzeUrl, setDeepSeekAnalyzeUrl,
    deepSeekPracticeUrl, setDeepSeekPracticeUrl, deepSeekConfigSaved, setDeepSeekConfigSaved,
    deepSeekConfigOpen, setDeepSeekConfigOpen,
    handleFileChange, handleUnitSelect,
    handleAnalyzeSentence, handleGeneratePractice, testDeepSeekConnection, translateSentence,
    pdfDoc, pdfTargetPage, pdfJumpSignal,
    onTranslateText, onAnalyzeText, onWordDetail, onAddWord,
    translationResult, translationLoading, wordDetailResult, wordDetailLoading,
    onGenerateUnitModule, unitModuleLoading, restoreNotice, onDismissRestoreNotice, onClearSavedMaterial,
    readerMode, setReaderMode, textbookMarkdown, mdStatus, mdProgress, mdError, mdSource,
    onGenerateMarkdown, onImportMarkdown, onJumpToPdfPage,
  } = props;
  const importMdRef = useRef<HTMLInputElement>(null);

  const handleImportMdFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await onImportMarkdown(text, file.name);
      setReaderMode('md');
    } catch (e) {
      console.warn('导入 Markdown 失败：', e);
    } finally {
      event.target.value = '';
    }
  };
  return (
    <>
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

  {pdfDoc && (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">📖 教材精读</h3>
            <p className="mt-1 text-xs text-slate-500">在原文上划线选中句子 / 段落 / 单词，即可翻译、解析句型、单词详解或加入生词本。</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setReaderMode('pdf')}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${readerMode === 'pdf' ? 'bg-coral text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
            >
              📄 PDF 原页
            </button>
            <button
              type="button"
              onClick={() => {
                if (readerMode !== 'md' && textbookMarkdown == null) onGenerateMarkdown();
                setReaderMode('md');
              }}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${readerMode === 'md' ? 'bg-coral text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
            >
              📝 Markdown 精读
            </button>
          </div>
        </div>
      </div>

      {readerMode === 'pdf' ? (
        <PdfViewer
          pdfDoc={pdfDoc}
          targetPage={pdfTargetPage}
          jumpSignal={pdfJumpSignal}
          onTranslateText={onTranslateText}
          onAnalyzeText={onAnalyzeText}
          onWordDetail={onWordDetail}
          onAddWord={onAddWord}
          translationResult={translationResult}
          translationLoading={translationLoading}
          wordDetailResult={wordDetailResult}
          wordDetailLoading={wordDetailLoading}
        />
      ) : textbookMarkdown ? (
        <MarkdownReader
          markdown={textbookMarkdown}
          fileName={pdfName ?? '教材'}
          sourceLabel={mdSource === 'imported' ? '已导入文件' : '内置 PDF→Markdown 转换'}
          units={materialPreview?.units ?? []}
          onJumpToPdfPage={onJumpToPdfPage}
          onTranslateText={onTranslateText}
          onAnalyzeText={onAnalyzeText}
          onWordDetail={onWordDetail}
          onAddWord={onAddWord}
          onImportMarkdown={onImportMarkdown}
        />
      ) : mdStatus === 'generating' ? (
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-8 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">正在把教材转换为 Markdown 精读文本…</p>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-coral transition-all duration-300"
              style={{ width: mdProgress ? `${Math.max(4, Math.round((mdProgress.done / mdProgress.total) * 100))}%` : '8%' }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {mdProgress ? `已处理 ${mdProgress.done} / ${mdProgress.total} 页` : '准备中…'}
          </p>
          <p className="mt-4 text-xs text-slate-500">
            转换在本地浏览器完成，教材不会上传。页数较多时首次生成约需几十秒，之后会自动缓存。
          </p>
        </div>
      ) : (
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-8 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">📝 Markdown 精读模式</p>
          <p className="mt-2 text-sm text-slate-600">
            把教材转成结构化 Markdown（标题 / 段落 / 列表 / 表格），排版更清爽，也更适合 AI 识别与深入分析。
          </p>
          {mdError && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-xs text-rose-700">生成失败：{mdError}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGenerateMarkdown}
              className="rounded-2xl bg-coral px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              ⚡ 生成 Markdown（本地转换）
            </button>
            <button
              type="button"
              onClick={() => importMdRef.current?.click()}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              📥 导入已有的 .md
            </button>
            <input ref={importMdRef} type="file" accept=".md,.markdown,.txt,text/markdown" className="hidden" onChange={handleImportMdFile} />
          </div>
          <p className="mt-4 text-xs text-slate-500">
            提示：也可用微软开源工具 MarkItDown 在本地把整本 PDF 转成 .md 后，直接在上方「导入已有的 .md」加载：
          </p>
          <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-900 p-3 text-xs leading-6 text-slate-100">
            {'pip install "markitdown[pdf]"\npython scripts/pdf_to_markdown.py 教材.pdf 教材.md'}
          </pre>
        </div>
      )}
    </div>
  )}

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
      {restoreNotice && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <span>{restoreNotice}</span>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => void onClearSavedMaterial()} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-100">
              清除已保存教材
            </button>
            <button type="button" onClick={onDismissRestoreNotice} className="rounded-xl bg-white px-2.5 py-1.5 text-xs text-slate-400 shadow-sm hover:bg-slate-100">✕</button>
          </div>
        </div>
      )}
      {error && <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {loading && <p className="mt-4 text-sm text-slate-600">正在提取，请稍候...</p>}
    </div>

  </div>

  {materialPreview && (
    <div className="rounded-[28px] bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">教材单元</h3>
      <p className="mt-2 text-sm text-slate-600">选择单元查看摘要与详细学习卡，或使用下方「单元目录」快速导航。</p>
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
                {unit.startPage ? <span className={`ml-1 text-xs ${selectedUnitIndex === index ? 'text-white/80' : 'text-slate-400'}`}>P{unit.startPage}</span> : null}
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
            </div>
            <div className="mt-5">
              <UnitSummaryCard title={selectedUnit.title} summary={selectedUnit.summary} />
            </div>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <UnitStudyModule
                unit={selectedUnit}
                loading={unitModuleLoading === selectedUnitIndex}
                onGenerate={() => void onGenerateUnitModule(selectedUnitIndex)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )}
</div>

      {materialPreview && (
<section className="mt-8 rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.07)]">
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h2 className="text-3xl font-semibold text-slate-900">教材总览</h2>
      <p className="mt-2 text-sm text-slate-600">教材结构概览：按单元导航学习，点击单元可查看详情并跳转 PDF 对应页。</p>
    </div>
    <div className="rounded-3xl bg-blush/80 px-5 py-3 text-slate-900">📄 {materialPreview.title}</div>
  </div>

  <div className="mt-6 grid gap-4 sm:grid-cols-2">
    <div className="rounded-3xl bg-cream p-5">
      <p className="text-sm text-slate-500">单元数量</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{materialPreview.units.length}</p>
    </div>
    <div className="rounded-3xl bg-cream p-5">
      <p className="text-sm text-slate-500">教材页数</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{materialPreview.pages}</p>
    </div>
  </div>

  <div className="mt-6 rounded-[28px] bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">单元目录</h3>
        <p className="mt-1 text-sm text-slate-600">共 {materialPreview.units.length} 个单元，点击任意单元查看详情并跳转 PDF 对应页。</p>
      </div>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      {materialPreview.units.map((unit, index) => (
        <button
          key={`${unit.title}-${index}`}
          type="button"
          onClick={() => handleUnitSelect(index)}
          className={`rounded-3xl border p-4 text-left transition ${
            selectedUnitIndex === index ? 'border-coral bg-coral/10' : 'border-slate-200 bg-cream hover:border-coral/70'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">单元 {index + 1}</span>
            {unit.startPage ? <span className="text-xs text-slate-400">P{unit.startPage}</span> : null}
          </div>
          <p className="mt-3 text-base font-semibold text-slate-900">{unit.title}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{unit.summary || '暂无摘要，建议先阅读本单元原文。'}</p>
          {unit.vocabulary.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {unit.vocabulary.slice(0, 5).map(word => (
                <span key={word.text} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{word.text}</span>
              ))}
              {unit.vocabulary.length > 5 && <span className="text-xs text-slate-400">+{unit.vocabulary.length - 5}</span>}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">💡 本单元收录 {unit.vocabulary.length} 个核心词 · {unit.sentences.length} 句课文</p>
        </button>
      ))}
    </div>
  </div>

  <div className="mt-6 rounded-[28px] bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">学习建议</h3>
        <p className="mt-2 text-sm text-slate-600">结合本教材拆分结果，推荐的完整学习流程。</p>
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
  </div>

  {(deepSeekParsePrompt || deepSeekParseResponse) && (
    <details className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
      <summary className="cursor-pointer text-sm font-medium text-slate-700">调试信息（DeepSeek Prompt / 解析结果）</summary>
      {deepSeekParsePrompt && (
        <div className="mt-3">
          <p className="font-medium text-slate-900">DeepSeek 解析 Prompt</p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{deepSeekParsePrompt}</pre>
        </div>
      )}
      {deepSeekParseResponse && (
        <div className="mt-3">
          <p className="font-medium text-slate-900">DeepSeek 解析结果（JSON 预览）</p>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{deepSeekParseResponse}</pre>
        </div>
      )}
    </details>
  )}

  <div className="mt-8 rounded-[28px] bg-cream p-6 shadow-sm">
    <h3 className="text-xl font-semibold text-slate-900">选中句子分析</h3>
    <p className="mt-2 text-sm text-slate-600">点击句子后，查看该句的语法重点和常见错误提示。</p>
    <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-900">当前句子</p>
        <div className="mt-3 min-h-[96px] rounded-3xl border border-slate-200 bg-cream p-4 text-sm leading-7 text-slate-700">
          {selectedSentence || '从「课程路径」的「句型精析」课时进入时，会自动分析该单元的核心句子。'}
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
    </>
  );
}
