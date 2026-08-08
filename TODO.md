# TODO / 项目进度

> 更新规则：完成一项就勾选 `[x]` 并附日期；新想法追加到「待办」。下次继续开发先看本文件与 AGENTS.md。

## ✅ 已完成
- [x] 学习卡补齐（2026-08-08）：语法精华要求完整覆盖教材 Grammaire 章节（提取单元 Markdown 的 Grammaire 段专门喂给 DeepSeek，5-10 个主题逐点覆盖）；新增「重点长难句」（keySentences，法/中/结构解析）与「写作积累句」（writingSentences，法/中/适用场景）；学习卡 cardVersion=2，旧卡片自动重新生成补齐；课程路径「句型精析」模块同步展示长难句+写作句并可逐句 DeepSeek 分析；无 Key 时本地提取兜底（src/lib/studyCard.ts）
- [x] 多教材支持（2026-08-08）：教材库（IndexedDB 按教材 id 存 PDF/Markdown/解析结果 + localStorage 存元数据）；Supabase 云端按 `user/<uid>/textbooks/<bookId>/` 存多本教材 + manifest 清单；教材中心教材库列表/打开/删除；精读页教材切换器；课程路径每本教材一条课程、进度按教材隔离（`bookId:u:l`）；旧版单教材自动迁移
- [x] 单元识别修复（2026-08-08）：本地拆分重写（目录页码定位 + 页首标记兜底，支持 Unité/Dossier/Leçon/Chapitre/Séquence/Mission/第X单元）；auto 模式大教材不再截断给 DeepSeek、返回不完整时回退本地；Édito A2 实测 12 单元、页码与目录完全一致（13/27/41…/167）
- [x] 云端同步错误可视化 + 50MB 兜底（2026-08-08）：上传失败显示真实状态码/响应体；PDF 超过免费档 50MB 时仍同步 Markdown+解析结果，保证跨设备可精读；教材库行显示云端同步状态与「重新同步」按钮
- [x] 纯逻辑模块抽取（2026-08-08）：src/lib/words.ts（词频/CEFR/翻译）、src/lib/units.ts（本地单元拆分），新增 10 个单元测试（共 29 个全过）
- [x] React + Vite + Tailwind 基础框架，暖色主题
- [x] 顶部导航 + 三个 Tab（学习 / 教材中心 / 进度）
- [x] PDF 上传与文本提取（pdfjs-dist），教材中心展示解析结果
- [x] 单元拆分、摘要、核心词汇词频、练习建议（本地逻辑）
- [x] DeepSeek 集成：官方直连 / 自定义端点 / 本地降级，配置面板 + 连接测试
- [x] 句子语法分析 + 练习生成（JSON 解析容错）
- [x] 生词本（localStorage 持久化）
- [x] 进度页：分析历史复盘、清空、导出
- [x] 课程路径改造（2026-08-07）：每单元 9 个模块（精读/句型/词汇/语法/常见错误/例句/跟读/闪卡/单元练习），内容来自 DeepSeek 详细学习卡；点击模块打开全屏独立页面；学完可进入对应练习；「单元练习」为最后模块，覆盖考级（DELF/DALF/TCF）全部题型（听力/阅读/语法/完形/词汇/排序/改错/写作复述/口语复述）
- [x] 自动测试（Vitest）+ CI（2026-08-08）：19 个单元测试（SRS 间隔重复/DeepSeek JSON 容错/单元练习/Markdown 分页）；GitHub Actions 自动 build+test
- [x] 国内访问优化准备（2026-08-08）：README 迁移 Cloudflare Pages 步骤 + public/_redirects SPA 回退（Vercel 上继续可用）
- [x] App.tsx 拆分 hooks（2026-08-08）：新增 src/lib/hooks.ts（useLocalStorageState / useDebouncedCloudSync），生词本/熟练度/SRS/历史/路径进度与 6 组云同步改为 hooks，App 缩减约百行
- [x] PWA / 离线可用（2026-08-08）：manifest + 图标 + Service Worker（缓存同源资源），首次访问自动刷新后断网可离线使用
- [x] Markdown 精读：生词高亮（生词本词黄色高亮）+ 双语对照（逐段「🌐 中译」，DeepSeek 翻译，点开显示中文）
- [x] 移除未使用的 react-router-dom 依赖（2026-08-08）
- [x] 闪卡系统升级（2026-08-08）：SM-2 间隔重复（遗忘/模糊/认识/简单 四档）+ 主动回忆卡片 + 拼写测验 + TTS 发音 + CEFR 分级过滤 + 今日待复习统计；生词本 CSV 导出/导入（按词去重合并）
- [x] 精读体验升级（2026-08-08）：单选词查词（释义置顶/搭配/变位+加入生词本）、翻译+详解合并为「精析」（先翻译再句型分析）、结果悬浮面板可关闭、移除教材中心选中句子分析
- [x] 教材云端存储（2026-08-08）：PDF/Markdown/文件名上传 Supabase Storage（用户隔离 RLS），新设备登录自动恢复；内置浏览器端 PDF 自动压缩（>45MB 上传时渲染压缩+隐形文字层，145MB→41.6MB）
- [x] Markdown 精读模式（2026-08-06）：PDF→Markdown 本地转换器（参考微软 MarkItDown 版式分析，重建标题/段落/列表/表格）+ 精读页（字号/行距/版宽/单元跳转/页对照/复制给 AI/下载 .md）+ 导入外部 .md + 微软 MarkItDown 本地脚本 scripts/pdf_to_markdown.py；单元学习卡生成改用单元 Markdown 原文喂给 DeepSeek

## 🔄 进行中 / 下一步候选（按优先级排序，由用户挑选）
- [x] **1. App.tsx 拆分重构**（2026-08-02 完成，1564 → 862 行，构建验证通过）
  - [x] 类型 → `src/types.ts`；DeepSeek 纯函数层 → `src/lib/deepseek.ts`
  - [x] 三个 Tab → `src/tabs/LearnTab.tsx` / `MaterialsTab.tsx` / `ProgressTab.tsx`
- [ ] 2. git 基线提交 — 文档已就绪，**需用户在终端执行**：`git init && git add -A && git commit -m "基线"`（Codex 沙箱禁止创建 .git）
- [x] 3. 学习 Tab 单词闪卡（2026-08-02：FlashcardDeck + 熟练度持久化）
- [x] 4. 通用学习系统完成（2026-08-03）：语法练习（DeepSeek 生成+离线题库）、写作批改（DeepSeek）、听力跟读（Web Speech API）
- [x] 4. 学习路径系统（2026-08-03）：新增「课程路径」Tab，仿 Luke Academy 的 CEFR 分级课程→单元→课时体系，课时解锁门槛 + 进度持久化；课时动作接入 PDF 跳页/生词本/语法练习/听力
- [x] 5. 单元页码映射修复（2026-08-03）：句子匹配大小写/弯引号归一 + 跳过目录页（p. XX 引用检测），Édito B2 12 单元实测全对；PDF 跳页改为等待目标页渲染出高度后再滚动
- [x] 6. 教材本地保存（2026-08-03）：PDF 存 IndexedDB（`french-companion` 库）+ 解析结果存 localStorage（`french-preview`），启动自动恢复，无需每次重新上传
- [x] 7. 单元详细学习卡（2026-08-03）：仿 DeepSeek 复习文档模式，每单元生成「分类词汇/语法精华/常见错误/中法例句」，课程路径展开自动生成，教材中心选中单元同步展示
- [ ] 8. 登录与云端存储（Supabase）——README 规划中的方向
- [ ] 7. 自动测试（Vitest）

## 💡 待办（想法池）
- [x] 闪卡练习模式增强：拼写测验、发音（TTS）、按 CEFR 分级过滤（2026-08-08）
- [x] 生词本导出/导入（2026-08-08）
- [ ] 深色模式切换
- [x] PWA / 离线可用（2026-08-08）
- [x] 移除未使用的 react-router-dom 依赖（2026-08-08）
- [x] Markdown 精读：双语对照 / 生词高亮 / 句子级点击分析（2026-08-08，句子级点击分析已随点击查词完成）
- [x] 教材 PDF 上传 Supabase Storage，实现「换设备自动恢复教材 + Markdown」（2026-08-08）

## 🔧 已知技术债
- App.tsx 仍集中了全部状态与业务逻辑（~860 行），可继续抽 hooks（如 useDeepSeek、useLocalStorage）
- DeepSeek API key 在前端暴露，存在泄露风险（长期应加代理后端）
- 无类型定义文件（types 都内联在 App.tsx 顶部）
- 无测试、无 CI
