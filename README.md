# 法语 A2→C2 学习伴侣

## 目录

- React + Vite + Tailwind 项目基础框架
- 暖色系主题、emoji 视觉元素
- 教材中心：PDF 上传与文本提取功能

## 启动

1. 进入目录：
   ```bash
   cd ~/FrenchA2C2Companion
   ```
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动开发服务器：
   ```bash
   npm run dev
   ```

## 说明

- 当前已实现：
  - 顶部导航栏样式展示
  - 教材中心页面上传 PDF
  - 使用 `pdfjs-dist` 提取文本并展示

- 后续可扩展：
  - Supabase 用户认证与学习记录存储
  - DeepSeek 调用实现语法分析、题目生成、写作批改
- 进度页已支持：分析历史复盘、清空历史、导出历史

## 配置 DeepSeek

### 方式一：直连官方 API（推荐）

1. 复制 `.env.example` 为 `.env`：
   ```bash
   cp .env.example .env
   ```
2. 配置官方 API 密钥与模型（也可直接在页面“DeepSeek 配置”卡片中填写，会保存到浏览器）：
   ```env
   VITE_DEEPSEEK_API_KEY=your_api_key_here
   VITE_DEEPSEEK_OFFICIAL_URL=https://api.deepseek.com
   VITE_DEEPSEEK_MODEL=deepseek-chat
   ```
3. 重新启动开发服务器：
   ```bash
   npm run dev
   ```

- 官方直连走 `POST {官方地址}/chat/completions`，请求体包含 `model` 与 `messages`。
- 页面支持选择模型：`deepseek-chat`（通用对话，推荐）或 `deepseek-reasoner`（深度推理）。
- 点“测试 DeepSeek 连接”可即时验证。

### 方式二：自建代理后端（高级）

如果你自己有提供 `/parse`、`/analyze`、`/practice` 三个端点的服务，可在页面“自定义后端接口”中填写对应完整地址（如 `https://myproxy.com/parse`），填写后对应功能会优先走自定义端点，否则回退官方 API。

> ⚠️ 注意：`VITE_DEEPSEEK_API_URL` / “基础后端地址”若包含 `deepseek.com`（如 `api.deepseek.com/anthropic`），会被自动识别为官方域名并按官方 API 处理，不会再拼接 `/parse` 等后缀。

- `自动 DeepSeek` 模式会在 DeepSeek 调用失败时降级到本地解析。
## Markdown 精读模式

「教材中心 → 教材精读」支持在 **PDF 原页** 与 **Markdown 精读** 两种模式间切换。

Markdown 精读页把教材转为结构化 Markdown（标题 / 段落 / 列表 / 表格），
排版更清爽，且结构化文本更利于 AI（DeepSeek 等）识别与分析。

- **自动转换（推荐）**：上传/恢复教材后，应用会在本地浏览器自动生成 Markdown（不离开设备，适合大文件），
  首次生成约需几十秒（按页数），之后自动缓存到 IndexedDB，无需重复生成。
- **划线精读**：在 Markdown 正文上划选句子/段落/单词，可翻译、句型分析、单词详解、加入生词本（与 PDF 原页一致）。
- **阅读辅助**：字号调节（A−/A+）、行距、版宽、按单元跳转、页标记（点击跳回 PDF 原页对照）。
- **喂给 AI**：一键「复制单元（给 AI）」/「复制全文」，把结构化 Markdown 粘贴到任意 AI；「下载 .md」可保存为文件。
- **导入外部 .md**：可用微软开源工具 **MarkItDown** 在本地转换超大 PDF 后导入：

  ```bash
  pip install "markitdown[pdf]"
  python scripts/pdf_to_markdown.py 教材.pdf 教材.md
  ```

  然后在「Markdown 精读」页点击「📥 导入 .md」加载。

> 说明：MarkItDown（https://github.com/microsoft/markitdown ）是微软开源的 PDF/Word/PPT→Markdown 工具；
> 应用内置的浏览器端转换器采用相同思路（按坐标/字号重建结构），两者可互补使用。

## 国内访问优化（可选迁移：Vercel → Cloudflare Pages）

当前部署在 Vercel（https://french-a2c2-companion.vercel.app），国内访问偶尔偏慢。
如需更快的国内体验，可迁移到 Cloudflare Pages（全球 CDN + 国内边缘节点，免费额度充足）：

1. Cloudflare 控制台 → **Workers & Pages → Create → Pages → Connect to Git**，选择本仓库（`JerrieRun/french-a2c2-companion`）。
2. 构建设置：Framework preset 选 **Vite**；Build command `npm run build`；Build output directory `dist`。
3. 环境变量（与 Vercel 相同）：
   - `VITE_SUPABASE_URL=https://kaecartwcmqobenpkpjx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=你的 anon key`
4. 部署完成后，访问 `https://<project>.pages.dev` 验证；SPA 回退已由仓库根目录 `public/_redirects`（`/* /index.html 200`）处理，无需额外配置。
5. 自定义域名：Pages → Custom domains 添加你的域名并配置 CNAME。

> 说明：`public/_redirects` 只对 Cloudflare Pages 生效（Vercel 自动处理 SPA 回退，忽略该文件）。
> 迁移前请先在两个平台都配好 Supabase 环境变量；Supabase 后台的 Site URL / 回调地址也要把新域名加入白名单。

## 自动化测试与 CI

- 单元测试：`npm test`（Vitest，覆盖 SRS 间隔重复、DeepSeek JSON 容错、单元练习生成、Markdown 分页工具等纯逻辑）。
- CI：`.github/workflows/ci.yml` 在 push/PR 时自动执行 `npm ci && npm run build && npm test`。
