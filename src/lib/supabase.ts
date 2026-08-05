/**
 * Supabase 云同步客户端（纯 REST，无需额外依赖）
 *
 * 覆盖两个能力：
 * 1. 认证（邮箱 + 密码）：注册 / 登录 / 登出 / 会话恢复与自动刷新
 * 2. 数据同步：把学习记录（生词本/闪卡/历史/路径进度/教材解析）按用户存到 user_data 表
 *
 * 需要环境变量（.env 或 Vercel 环境变量）：
 *   VITE_SUPABASE_URL     例如 https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY 例如 sb_publishable_xxx 或 eyJ...
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** 需要云同步的 localStorage 键（学习记录，不含 DeepSeek 等设备本地配置） */
export const SYNC_KEYS = [
  'french-word-book',
  'french-flashcard-mastery',
  'french-analysis-history',
  'french-path-progress',
  'french-preview',
] as const;
export type SyncKey = (typeof SYNC_KEYS)[number];

export type SupabaseUser = { id: string; email: string | null };

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // 毫秒时间戳
  user: SupabaseUser;
};

const SESSION_KEY = 'french-supabase-session';

/* ---------- 基础请求 ---------- */

type AuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email: string | null };
  error?: string;
  error_description?: string;
  msg?: string;
};

async function requestJson(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return res;
}

function getErrorMessage(data: AuthResponse | Record<string, unknown>): string {
  const d = data as AuthResponse & { message?: string };
  return (
    d.error_description ??
    d.msg ??
    d.error ??
    d.message ??
    '操作失败，请稍后重试'
  );
}

/* ---------- 会话管理 ---------- */

export function getStoredSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function storeSession(session: Session | null) {
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
}

/** 用 access_token 换取用户信息；401 时用 refresh_token 刷新一次 */
export async function getCurrentUser(): Promise<SupabaseUser | null> {
  let session = getStoredSession();
  if (!session) return null;

  const tryWith = async (token: string): Promise<SupabaseUser | null> => {
    const res = await requestJson('/auth/v1/user', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return (await res.json()) as SupabaseUser;
    return null;
  };

  let user = await tryWith(session.access_token);
  if (user) return user;

  // token 过期 → 尝试刷新
  const refreshRes = await requestJson('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!refreshRes.ok) {
    storeSession(null);
    return null;
  }
  const data = (await refreshRes.json()) as AuthResponse;
  if (!data.access_token || !data.refresh_token || !data.user) {
    storeSession(null);
    return null;
  }
  session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    user: { id: data.user.id, email: data.user.email },
  };
  storeSession(session);
  return tryWith(session.access_token);
}

/* ---------- 认证 ---------- */

/** 邮箱 + 密码注册。若项目开启了邮箱确认，需要用户点击确认邮件后再登录。 */
export async function signUpWithEmail(email: string, password: string): Promise<SupabaseUser> {
  const res = await requestJson('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as AuthResponse & {
    session?: { access_token?: string; refresh_token?: string; expires_in?: number; user?: { id: string; email: string | null } };
  };
  if (!res.ok) throw new Error(getErrorMessage(data));
  // 注册响应可能是扁平结构（access_token 在顶层）或嵌套结构（session 里）
  const session = data.session;
  const token = data.access_token || session?.access_token;
  const refresh = (data.refresh_token || session?.refresh_token) ?? '';
  const expiresIn = data.expires_in ?? session?.expires_in ?? 3600;
  const uid = data.user?.id || session?.user?.id || '';
  const mail = data.user?.email || session?.user?.email || email;
  if (!token) {
    // 项目开启了邮箱确认：注册成功但没有会话，提示用户去邮箱确认
    throw new Error('注册成功！请前往邮箱点击确认链接后，再回来登录。');
  }
  storeSession({
    access_token: token,
    refresh_token: refresh,
    expires_at: Date.now() + expiresIn * 1000,
    user: { id: uid, email: mail },
  });
  return { id: uid, email: mail };
}

/** 邮箱 + 密码登录 */
export async function signInWithEmail(email: string, password: string): Promise<SupabaseUser> {
  const res = await requestJson('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as AuthResponse;
  if (!res.ok || !data.access_token || !data.user) {
    throw new Error(getErrorMessage(data) || '邮箱或密码不正确');
  }
  storeSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? '',
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000,
    user: { id: data.user.id, email: data.user.email },
  });
  return { id: data.user.id, email: data.user.email };
}

/** 登出（清本地会话 + 通知服务端） */
export async function signOut(): Promise<void> {
  const session = getStoredSession();
  if (session?.access_token) {
    try {
      await requestJson('/auth/v1/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // 忽略网络错误，本地一定清掉
    }
  }
  storeSession(null);
}

/* ---------- 数据同步 ---------- */

function authHeaders(): Record<string, string> {
  const session = getStoredSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

/** 拉取当前用户全部学习记录 */
export async function fetchAllUserData(): Promise<Partial<Record<SyncKey, unknown>>> {
  const res = await requestJson('/rest/v1/user_data?select=key,value', {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`拉取云端数据失败（${res.status}）`);
  const rows = (await res.json()) as Array<{ key: SyncKey; value: unknown }>;
  const result: Partial<Record<SyncKey, unknown>> = {};
  for (const row of rows) {
    if (SYNC_KEYS.includes(row.key)) result[row.key] = row.value;
  }
  return result;
}

/** 写入（upsert）一条学习记录 */
export async function pushUserData(key: SyncKey, value: unknown): Promise<void> {
  const session = getStoredSession();
  if (!session) throw new Error('未登录');
  const res = await requestJson('/rest/v1/user_data', {
    method: 'POST',
    headers: {
      ...authHeaders(),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([
      {
        user_id: session.user.id,
        key,
        value,
        updated_at: new Date().toISOString(),
      },
    ]),
  });
  if (!res.ok) throw new Error(`同步失败（${res.status}）`);
}
