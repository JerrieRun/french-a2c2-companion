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