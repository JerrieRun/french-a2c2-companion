import type { FlashcardSrs } from '../types';

export type SrsGrade = 'again' | 'hard' | 'good' | 'easy';

const DAY = 24 * 60 * 60 * 1000;

export function createSrs(word: string, translation: string, cefr: string): FlashcardSrs {
  return { word, translation, cefr: cefr || 'B2', mastery: 0, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0 };
}

/** SM-2 风格间隔重复：按「遗忘/模糊/认识/简单」更新下次复习时间 */
export function gradeSrs(srs: FlashcardSrs, grade: SrsGrade, now = Date.now()): FlashcardSrs {
  let { ease, interval, reps, lapses, mastery } = srs;
  switch (grade) {
    case 'again':
      ease = Math.max(1.3, ease - 0.2);
      interval = 0;
      reps = 0;
      lapses += 1;
      mastery = Math.max(0, mastery - 2);
      break;
    case 'hard':
      ease = Math.max(1.3, ease - 0.15);
      interval = interval <= 0 ? 1 : Math.max(1, Math.ceil(interval * 1.2));
      reps += 1;
      mastery = Math.max(0, mastery - 1);
      break;
    case 'good':
      interval = interval <= 0 ? 1 : Math.ceil(interval * ease);
      reps += 1;
      mastery = Math.min(5, mastery + 1);
      break;
    case 'easy':
      interval = interval <= 0 ? 3 : Math.ceil(interval * ease * 1.3);
      reps += 1;
      mastery = Math.min(5, mastery + 2);
      break;
  }
  return { ...srs, ease: +ease.toFixed(2), interval, reps, lapses, mastery, due: now + interval * DAY };
}

/** 是否到期（无记录或已到复习时间） */
export function isDue(srs: FlashcardSrs | undefined, now = Date.now()): boolean {
  return !srs || srs.due <= now;
}

/** 间隔可读文案，如「10 分钟」「3 天」 */
export function intervalLabel(days: number): string {
  if (days <= 0) return '今天再学';
  if (days < 1 / 24) return '几分钟后';
  if (days < 1) return `${Math.round(days * 24)} 小时后`;
  return `${days} 天后`;
}
