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
- `src/App.tsx` — **唯一的巨型组件**（~1560 行）：全部状态、逻辑与三个 Tab 的 JSX
- `src/components/` — 单元摘要/词汇/练习卡片（纯展示组件）
- `src/index.css` + `tailwind.config.js` — 暖色主题；自定义色：cream #fff5d6、lavender、blush、sky、coral #ff8966、warm
- `sample.pdf` — 测试用教材样本

## 核心实现约定
- 三个 Tab：`learn`（通用学习）/ `materials`（教材中心）/ `progress`（进度复盘），默认 `materials`
- 主流程：上传 PDF → 提取文本 → 拆单元（`buildLocalUnitsFromText`）→ 提取词频候选（`extractWordCandidates`）→ 用户选句 → DeepSeek 分析/出题
- DeepSeek 支持三种调用方式：官方直连（`api.deepseek.com/chat/completions`）、自定义代理端点（`/parse` `/analyze` `/practice`）、纯本地降级；配置可存 localStorage
- 分析结果须为合法 JSON；用 `extractJson` 做容错解析
- 持久化 key：`french-word-book`、`french-analysis-history`、`deepseek-*`

## 当前已知问题 / 技术债（详见 TODO.md）
1. `App.tsx` 单文件过大，逻辑与 JSX 混在一起，建议按 Tab 拆分
2. 无 git 仓库（截至 2026-08-02 已初始化，基线在首次提交）
3. DeepSeek 密钥直接打进前端（Vite 环境变量），有泄露风险
4. 没有自动化测试
