import { useEffect, useRef, useState } from 'react';

const RATES = [0.7, 0.9, 1.0];

export function ListeningPractice() {
  const [text, setText] = useState('Bonjour, je suis ravi de vous rencontrer.');
  const [rate, setRate] = useState(0.9);
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const speak = () => {
    if (!supported || !text.trim()) return;
    stop();
    const u = new SpeechSynthesisUtterance(text.trim());
    u.lang = 'fr-FR';
    u.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.toLowerCase().startsWith('fr'));
    if (frVoice) u.voice = frVoice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  useEffect(() => () => stop(), []);

  return (
    <article className="rounded-[28px] bg-cream p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">听力跟读 🎧</h3>
      <p className="mt-2 text-sm text-slate-600">输入法语，用浏览器语音朗读（免费，无需 API）。</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        placeholder="Saisissez du texte en français…"
        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-900 outline-none focus:border-sky"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">语速</span>
        {RATES.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => setRate(r)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${rate === r ? 'bg-lavender text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            {r}x
          </button>
        ))}
        {speaking ? (
          <button
            type="button"
            onClick={stop}
            className="ml-auto rounded-2xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
          >
            停止 ⏹
          </button>
        ) : (
          <button
            type="button"
            onClick={speak}
            disabled={!supported || !text.trim()}
            className="ml-auto rounded-2xl bg-gradient-to-r from-warm to-coral px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
          >
            朗读 🔊
          </button>
        )}
      </div>
      {!supported && <p className="mt-3 text-xs text-slate-500">当前浏览器不支持语音合成，建议用 Chrome/Edge。</p>}
    </article>
  );
}
