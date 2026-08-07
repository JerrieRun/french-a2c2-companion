/** 法语朗读辅助（浏览器 speechSynthesis，fr-FR，免 API） */

/** 朗读一段法语文本 */
export function speakFrench(text: string, rate = 1): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.rate = rate;
  // 优先选择法语语音
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.find(v => v.lang.toLowerCase().startsWith('fr'));
  if (fr) u.voice = fr;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
