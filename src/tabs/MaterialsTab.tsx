import type { ChangeEvent } from 'react';
import { UnitPracticeCard } from '../components/UnitPracticeCard';
import { UnitSummaryCard } from '../components/UnitSummaryCard';
import { UnitVocabularyCard } from '../components/UnitVocabularyCard';
import type { AnalysisResult, MaterialPreview, UnitSection, WordCandidate } from '../types';

type ParseMode = 'auto' | 'deepseek' | 'local';

type MaterialsTabProps = {
  // 教材与解析状态
  pdfName: string | null;
  pdfText: string;
  error: string | null;
  loading: boolean;
  parseMethod: string;
  parseMode: ParseMode;
  setParseMode: (mode: ParseMode) => void;
  showFullText: boolean;
  setShowFullText: (updater: (prev: boolean) => boolean) => void;
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
  handleUnitSelect: (index: number) => void;
  handleSentenceSelect: (index: number) => void;
  handleAddToWordBook: (candidate: WordCandidate) => void;
  handleAnalyzeSentence: () => Promise<void>;
  handleGeneratePractice: () => Promise<void>;
  testDeepSeekConnection: () => Promise<void>;
  translateSentence: (sentence: string) => string;
};

export function MaterialsTab(props: MaterialsTabProps) {
  const {
    pdfName, pdfText, error, loading, parseMethod, parseMode, setParseMode,
    showFullText, setShowFullText, materialPreview, selectedUnit, selectedUnitIndex,
    displayedSentences, sentenceCount, selectedSentence, selectedSentenceIndex,
    candidateWords, wordBook, deepSeekStudyPlan, deepSeekModeLabel,
    analysisResult, analysisPrompt, practiceExercises, practicePrompt,
    deepSeekParsePrompt, deepSeekParseResponse, deepSeekTestStatus, deepSeekTesting,
    deepSeekApiKey, setDeepSeekApiKey, deepSeekModel, setDeepSeekModel,
    deepSeekOfficialUrl, setDeepSeekOfficialUrl, deepSeekApiUrl, setDeepSeekApiUrl,
    deepSeekParseUrl, setDeepSeekParseUrl, deepSeekAnalyzeUrl, setDeepSeekAnalyzeUrl,
    deepSeekPracticeUrl, setDeepSeekPracticeUrl, deepSeekConfigSaved, setDeepSeekConfigSaved,
    deepSeekConfigOpen, setDeepSeekConfigOpen,
    handleFileChange, handleUnitSelect, handleSentenceSelect, handleAddToWordBook,
    handleAnalyzeSentence, handleGeneratePractice, testDeepSeekConnection, translateSentence,
  } = props;
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

      {materialPreview && (
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
    </>
  );
}
