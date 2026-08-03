# AGENTS.md — 项目速查（每次开发前先读这里）

## 项目是什么
「法语 A2→C2 学习伴侣」：面向中高级法语学习者的单页 Web 应用。暖色系 + emoji 风格，
支持上传 PDF 教材、提取课文、拆分为单元、DeepSeek 语法/题目/练习生成、生词本与学习复盘。

## 技术栈
- React 18 + TypeScript（strict）+ Vite 5 + Tailwind 3
- pdfjs-dist（PDF 文本提取）
- 无后端：全部状态存浏览器 localStorage
- react-router-dom 已安装但**未使用**（应用用 useState 切 Tab）

## 常用命令
- `npm run dev` — 启动开发服务器
- `npm run build` — 类型检查 + 构建（改完代码务必跑一遍）
- `npm run preview` — 预览构建产物

## 目录结构
- `src/App.tsx` — 根组件（~860 行）：全局状态 + 业务逻辑 + Tab 路由
- `src/tabs/LearnTab.tsx` — 学习 Tab：单词闪卡、语法练习、写作批改、听力跟读（2 列网格）
- `src/tabs/PathTab.tsx` — 课程路径 Tab：CEFR 分级课程卡 → 单元 → 8 类课时（精读/句型/词汇/练习/跟读/语法/写作/复习，全部直接可学，无解锁门槛），进度标记持久化（localStorage `french-path-progress`）
- `src/tabs/MaterialsTab.tsx` — 教材中心 Tab（解析、选句分析、DeepSeek 配置、生词收藏）
- `src/tabs/ProgressTab.tsx` — 进度复盘 Tab
- `src/components/FlashcardDeck.tsx` — 单词闪卡组件（翻面动画、认识/再练、熟练度）
- `src/components/GrammarPractice.tsx` — 语法练习（DeepSeek 生成 / 无 Key 时用 STATIC_GRAMMAR 离线题库）
- `src/components/WritingPractice.tsx` — 写作批改（DeepSeek）
- `src/components/ListeningPractice.tsx` — 听力跟读（浏览器 speechSynthesis，fr-FR，免 API）
- `src/components/` — 单元摘要/词汇/练习卡片（纯展示组件）
- `src/lib/deepseek.ts` — DeepSeek 纯函数层（prompt/URL/API 调用/JSON 容错）
- `src/types.ts` — 全局类型定义
- `src/index.css` + `tailwind.config.js` — 暖色主题；自定义色：cream #fff5d6、lavender、blush、sky、coral #ff8966、warm；闪卡翻转动画类 `flashcard-*`
- `sample.pdf` — 测试用教材样本

## 核心实现约定
- 三个 Tab：`learn`（通用学习）/ `materials`（教材中心）/ `progress`（进度复盘），默认 `materials`
- 主流程：上传 PDF → 提取文本 → 拆单元（`buildLocalUnitsFromText`）→ 提取词频候选（`extractWordCandidates`）→ 用户选句 → DeepSeek 分析/出题
- DeepSeek 支持三种调用方式：官方直连（`api.deepseek.com/chat/completions`）、自定义代理端点（`/parse` `/analyze` `/practice`）、纯本地降级；配置可存 localStorage
- 分析结果须为合法 JSON；用 `extractJson` 做容错解析
- 持久化 key：`french-word-book`、`french-analysis-history`、`french-flashcard-mastery`（闪卡熟练度 0-5）、`french-path-progress`（课时完成）、`deepseek-*`

## 当前已知问题 / 技术债（详见 TODO.md）
1. `App.tsx` 仍有 ~860 行（逻辑+状态集中），可进一步拆分 hooks/业务层
2. 无 git 仓库基线（截至 2026-08-02 待用户执行 init；Codex 沙箱禁止创建 .git）
3. DeepSeek 密钥直接打进前端（Vite 环境变量），有泄露风险
4. 没有自动化测试
