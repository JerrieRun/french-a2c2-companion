import { useState } from 'react';

type AuthModalProps = {
  open: boolean;
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
  onSubmit: (email: string, password: string, mode: 'login' | 'signup') => Promise<void> | void;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
};

export function AuthModal({ open, mode, onModeChange, onSubmit, submitting, error, onClose }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit(email, password, mode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold text-slate-900">
            {mode === 'login' ? '☁️ 登录同步' : '☁️ 注册账号'}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {mode === 'login'
            ? '登录后自动同步生词本、闪卡、进度与教材记录，换设备也能接着学。'
            : '注册后学习记录会安全保存在云端，任何设备登录都能恢复。'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="auth-email">邮箱</label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-cream px-4 py-3 text-sm text-slate-900 outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="auth-password">密码</label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="至少 6 位"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-cream px-4 py-3 text-sm text-slate-900 outline-none focus:border-coral"
            />
          </div>

          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-coral px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {submitting ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          {mode === 'login' ? (
            <>
              还没有账号？{' '}
              <button type="button" className="font-semibold text-coral" onClick={() => onModeChange('signup')}>注册</button>
            </>
          ) : (
            <>
              已有账号？{' '}
              <button type="button" className="font-semibold text-coral" onClick={() => onModeChange('login')}>去登录</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
