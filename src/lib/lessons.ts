export type LessonDef = {
  key: string;
  icon: string;
  name: string;
  desc: string;
  /** 该模块内容来自 DeepSeek 详细学习卡 */
  needsCard?: boolean;
  /** 是否最后一个模块（单元练习） */
  last?: boolean;
};

/** 每个单元固定 9 个模块：内容来自 DeepSeek 详细学习卡，单元练习为最后一个模块（覆盖考级全部题型） */
export const LESSONS: LessonDef[] = [
  { key: 'reading', icon: '📖', name: '课文精读', desc: '回到本单元课文原文精读，可逐句朗读跟读，理解上下文。' },
  { key: 'pattern', icon: '🧩', name: '句型精析', desc: '用 DeepSeek 拆解本单元核心句型的语法结构、归纳用法并指出易错点。', needsCard: true },
  { key: 'vocab', icon: '📚', name: '核心词汇', desc: '本单元分类核心词汇（来自 DeepSeek 详细学习卡），可一键加入生词本。', needsCard: true },
  { key: 'grammar', icon: '✍️', name: '语法精华', desc: '本单元语法要点与变位表格（来自详细学习卡）。', needsCard: true },
  { key: 'mistakes', icon: '⚠️', name: '常见错误', desc: '本单元高频易错点：错句 → 正确句 + 原因说明。', needsCard: true },
  { key: 'examples', icon: '💬', name: '中法例句', desc: '本单元核心词汇与语法点的中法对照例句，可跟读。', needsCard: true },
  { key: 'listening', icon: '🗣️', name: '朗读跟读', desc: '逐句听读本单元课文，可调节语速，模仿语音语调。' },
  { key: 'review', icon: '🔄', name: '闪卡复习', desc: '本单元词汇闪卡速览，认识/再练，巩固记忆。' },
  { key: 'practice', icon: '🎯', name: '单元练习', desc: '覆盖法语考级（DELF B2 / DALF C1 / TCF）全部题型：听力、阅读、语法、完形、词汇、句子重组、改错、写作复述、口语复述。', last: true },
];
