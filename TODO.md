# TODO / 项目进度

> 更新规则：完成一项就勾选 `[x]` 并附日期；新想法追加到「待办」。下次继续开发先看本文件与 AGENTS.md。

## ✅ 已完成
- [x] React + Vite + Tailwind 基础框架，暖色主题
- [x] 顶部导航 + 三个 Tab（学习 / 教材中心 / 进度）
- [x] PDF 上传与文本提取（pdfjs-dist），教材中心展示解析结果
- [x] 单元拆分、摘要、核心词汇词频、练习建议（本地逻辑）
- [x] DeepSeek 集成：官方直连 / 自定义端点 / 本地降级，配置面板 + 连接测试
- [x] 句子语法分析 + 练习生成（JSON 解析容错）
- [x] 生词本（localStorage 持久化）
- [x] 进度页：分析历史复盘、清空、导出

## 🔄 进行中 / 下一步候选（按优先级排序，由用户挑选）
- [x] **1. App.tsx 拆分重构**（2026-08-02 完成，1564 → 862 行，构建验证通过）
  - [x] 类型 → `src/types.ts`；DeepSeek 纯函数层 → `src/lib/deepseek.ts`
  - [x] 三个 Tab → `src/tabs/LearnTab.tsx` / `MaterialsTab.tsx` / `ProgressTab.tsx`
- [ ] 2. git 基线提交 — 文档已就绪，**需用户在终端执行**：`git init && git add -A && git commit -m "基线"`（Codex 沙箱禁止创建 .git）
- [x] 3. 学习 Tab 单词闪卡（2026-08-02：FlashcardDeck + 熟练度持久化）
- [x] 4. 通用学习系统完成（2026-08-03）：语法练习（DeepSeek 生成+离线题库）、写作批改（DeepSeek）、听力跟读（Web Speech API）
- [ ] 4. 登录与云端存储（Supabase）——README 规划中的方向
- [ ] 5. 自动测试（Vitest）

## 💡 待办（想法池）
- [ ] 闪卡练习模式增强：拼写测验、发音（TTS）、按 CEFR 分级过滤
- [ ] 生词本导出/导入（目前只有进度历史能导出）
- [ ] 深色模式切换
- [ ] PWA / 离线可用
- [ ] 移除未使用的 react-router-dom 依赖（或真正引入路由）

## 🔧 已知技术债
- App.tsx 仍集中了全部状态与业务逻辑（~860 行），可继续抽 hooks（如 useDeepSeek、useLocalStorage）
- DeepSeek API key 在前端暴露，存在泄露风险（长期应加代理后端）
- 无类型定义文件（types 都内联在 App.tsx 顶部）
- 无测试、无 CI
