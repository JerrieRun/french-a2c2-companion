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
  'french-flashcard-srs',
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

/* ---------- 教材存储（Supabase Storage，跨设备恢复，支持多本教材） ----------
 *
 * 目录结构（每本教材一个子目录，manifest.json 记录教材清单）：
 *   user/<uid>/textbooks/manifest.json
 *   user/<uid>/textbooks/<bookId>/textbook.pdf
 *   user/<uid>/textbooks/<bookId>/textbook.md
 *   user/<uid>/textbooks/<bookId>/preview.json   （解析结果：单元列表，供课程路径/跨设备恢复）
 *   user/<uid>/textbooks/<bookId>/meta.json      （原始文件名等元数据）
 *
 * 免费档单文件上限 50MB：PDF 超限时仍可上传 Markdown + 解析结果，保证跨设备可精读。
 */

const TEXTBOOK_BUCKET = 'textbooks';

export type CloudBookMeta = {
  id: string;
  name: string;
  level: string;
  pages: number;
  sentenceCount: number;
  unitCount: number;
  source: 'pdf' | 'md';
  savedAt: string;
  size: number;
  hasPdf: boolean;
  hasMd: boolean;
  hasPreview: boolean;
};

const bookPath = (uid: string, bookId: string, file: string) => `user/${uid}/textbooks/${bookId}/${file}`;
const manifestPath = (uid: string) => `user/${uid}/textbooks/manifest.json`;

function storageHeaders(): Record<string, string> {
  const session = getStoredSession();
  return {
    Authorization: `Bearer ${session?.access_token ?? ''}`,
    apikey: SUPABASE_ANON_KEY,
  };
}

/** 上传/覆盖一个文件到当前用户教材目录；失败时抛出带状态码与响应体的错误 */
export async function uploadCloudBookFile(
  uid: string,
  bookId: string,
  file: string,
  data: ArrayBuffer | string,
  contentType: string
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${TEXTBOOK_BUCKET}/${bookPath(uid, bookId, file)}`, {
    method: 'POST',
    headers: {
      ...storageHeaders(),
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: data,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`上传 ${file} 失败（HTTP ${res.status}）${text.slice(0, 200)}`);
  }
}

/** 上传教材清单（与云端已有清单合并，避免覆盖其他教材） */
export async function uploadCloudManifest(uid: string, entries: CloudBookMeta[]): Promise<void> {
  let existing: CloudBookMeta[] = [];
  try {
    const old = await fetchCloudManifest(uid);
    if (old) existing = old;
  } catch {
    /* 拉取失败时以本地为准 */
  }
  const merged = [...existing];
  for (const entry of entries) {
    const idx = merged.findIndex(b => b.id === entry.id);
    if (idx >= 0) merged[idx] = entry;
    else merged.push(entry);
  }
  // 清单固定位于 user/<uid>/textbooks/manifest.json（不能走 bookPath，否则会变成 .../manifest/manifest.json）
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${TEXTBOOK_BUCKET}/${manifestPath(uid)}`, {
    method: 'POST',
    headers: {
      ...storageHeaders(),
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    },
    body: JSON.stringify(merged),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`上传教材清单失败（HTTP ${res.status}）${text.slice(0, 200)}`);
  }
}

export async function fetchCloudManifest(uid: string): Promise<CloudBookMeta[] | null> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${TEXTBOOK_BUCKET}/${manifestPath(uid)}`, {
    headers: storageHeaders(),
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`读取教材清单失败（HTTP ${res.status}）`);
  try {
    const data = (await res.json()) as CloudBookMeta[];
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** 下载某个云端文件；不存在返回 null */
export async function downloadCloudBookFile(
  uid: string,
  bookId: string,
  file: string
): Promise<ArrayBuffer | string | null> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${TEXTBOOK_BUCKET}/${bookPath(uid, bookId, file)}`, {
    headers: storageHeaders(),
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`下载 ${file} 失败（HTTP ${res.status}）`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json') || ct.includes('text') || ct.includes('markdown')) {
    return await res.text();
  }
  return await res.arrayBuffer();
}

/** 下载某本教材的解析结果（MaterialPreview JSON） */
export async function downloadCloudBookPreview(uid: string, bookId: string): Promise<unknown | null> {
  const raw = await downloadCloudBookFile(uid, bookId, 'preview.json');
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 删除某本教材的云端全部文件（含清单条目） */
export async function deleteCloudBook(uid: string, bookId: string): Promise<void> {
  const files = ['textbook.pdf', 'textbook.md', 'preview.json', 'meta.json'];
  await Promise.all(
    files.map(file =>
      fetch(`${SUPABASE_URL}/storage/v1/object/${TEXTBOOK_BUCKET}/${bookPath(uid, bookId, file)}`, {
        method: 'DELETE',
        headers: storageHeaders(),
      }).catch(() => undefined)
    )
  );
  // 更新清单：移除该教材
  const manifest = await fetchCloudManifest(uid).catch(() => null);
  if (manifest) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${TEXTBOOK_BUCKET}/${manifestPath(uid)}`, {
      method: 'POST',
      headers: {
        ...storageHeaders(),
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body: JSON.stringify(manifest.filter(b => b.id !== bookId)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`更新教材清单失败（HTTP ${res.status}）${text.slice(0, 200)}`);
    }
  }
}
