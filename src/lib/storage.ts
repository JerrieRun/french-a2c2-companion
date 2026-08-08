import type { MaterialPreview, TextbookMeta } from '../types';

const DB_NAME = 'french-companion';
const STORE = 'files';
const PDF_KEY = 'current-pdf';
const PREVIEW_KEY = 'french-preview';

type StoredPdf = {
  id: string;
  name: string;
  savedAt: string;
  data: ArrayBuffer;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 把上传的 PDF 存入 IndexedDB（支持大文件，无需每次重新上传） */
export async function savePdfFile(name: string, data: ArrayBuffer): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: PDF_KEY, name, savedAt: new Date().toISOString(), data } as StoredPdf, PDF_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** 读取已保存的 PDF；没有则返回 null */
export async function loadPdfFile(): Promise<{ name: string; data: ArrayBuffer } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(PDF_KEY);
    req.onsuccess = () => {
      const rec = req.result as StoredPdf | undefined;
      db.close();
      resolve(rec ? { name: rec.name, data: rec.data } : null);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** 删除已保存的 PDF */
export async function clearPdfFile(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(PDF_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** 解析结果（materialPreview）存入 localStorage（体积小，适合） */
export function savePreview(preview: MaterialPreview): void {
  try {
    window.localStorage.setItem(PREVIEW_KEY, JSON.stringify(preview));
  } catch (e) {
    console.warn('保存教材解析结果失败：', e);
  }
}

export function loadPreview(): MaterialPreview | null {
  try {
    const raw = window.localStorage.getItem(PREVIEW_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as MaterialPreview;
    if (!data || !Array.isArray(data.units)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearPreview(): void {
  window.localStorage.removeItem(PREVIEW_KEY);
}

const TEXTBOOK_MD_KEY = 'textbook-md';

/** Markdown 精读文本（可能较大，直接存 IndexedDB，避免 localStorage 5MB 限制） */
export async function saveTextbookMarkdown(markdown: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(
      { id: TEXTBOOK_MD_KEY, savedAt: new Date().toISOString(), data: markdown } as { id: string; savedAt: string; data: string },
      TEXTBOOK_MD_KEY
    );
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadTextbookMarkdown(): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(TEXTBOOK_MD_KEY);
    req.onsuccess = () => {
      const rec = req.result as { data?: string } | undefined;
      db.close();
      resolve(rec?.data ?? null);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function clearTextbookMarkdown(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(TEXTBOOK_MD_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/* ============================================================
 * 多教材支持：每本教材按 id 存 IndexedDB（PDF / Markdown / 解析结果），
 * 教材库元数据存 localStorage（french-textbook-library）。
 * 旧版单教材 key（current-pdf / textbook-md / french-preview）保留用于迁移。
 * ============================================================ */


const LIBRARY_KEY = 'french-textbook-library';

const bookKey = (id: string, kind: 'pdf' | 'md' | 'preview') => `textbook:${id}:${kind}`;

function putObjectStore(key: string, value: unknown): Promise<void> {
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

function getObjectStore<T>(key: string): Promise<T | null> {
  return openDb().then(db => new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => {
      const rec = req.result as T | undefined;
      db.close();
      resolve(rec ?? null);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}

function deleteObjectStore(key: string): Promise<void> {
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

type StoredBlob = { id: string; name?: string; savedAt: string; data: unknown };

/** 保存某本教材的 PDF 到 IndexedDB */
export async function saveTextbookPdf(id: string, name: string, data: ArrayBuffer): Promise<void> {
  await putObjectStore(bookKey(id, 'pdf'), { id, name, savedAt: new Date().toISOString(), data } as StoredBlob);
}

/** 读取某本教材的 PDF；没有则返回 null */
export async function loadTextbookPdf(id: string): Promise<{ name: string; data: ArrayBuffer } | null> {
  const rec = await getObjectStore<StoredBlob & { name?: string; data?: ArrayBuffer }>(bookKey(id, 'pdf'));
  return rec?.data ? { name: rec.name ?? '教材.pdf', data: rec.data } : null;
}

export async function deleteTextbookPdf(id: string): Promise<void> {
  await deleteObjectStore(bookKey(id, 'pdf'));
}

/** 保存某本教材的 Markdown 精读文本 */
export async function saveTextbookMarkdownFor(id: string, markdown: string): Promise<void> {
  await putObjectStore(bookKey(id, 'md'), { id, savedAt: new Date().toISOString(), data: markdown } as StoredBlob);
}

export async function loadTextbookMarkdownFor(id: string): Promise<string | null> {
  const rec = await getObjectStore<StoredBlob & { data?: string }>(bookKey(id, 'md'));
  return rec?.data ?? null;
}

export async function deleteTextbookMarkdownFor(id: string): Promise<void> {
  await deleteObjectStore(bookKey(id, 'md'));
}

/** 保存某本教材的解析结果（MaterialPreview） */
export async function saveTextbookPreviewFor(id: string, preview: MaterialPreview): Promise<void> {
  await putObjectStore(bookKey(id, 'preview'), { id, savedAt: new Date().toISOString(), data: preview } as StoredBlob);
}

export async function loadTextbookPreviewFor(id: string): Promise<MaterialPreview | null> {
  const rec = await getObjectStore<StoredBlob & { data?: MaterialPreview }>(bookKey(id, 'preview'));
  return rec?.data ?? null;
}

export async function deleteTextbookPreviewFor(id: string): Promise<void> {
  await deleteObjectStore(bookKey(id, 'preview'));
}

/* ---------- 教材库元数据（localStorage） ---------- */

export function saveTextbookLibrary(books: TextbookMeta[]): void {
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(books));
  } catch (e) {
    console.warn('保存教材库失败：', e);
  }
}

export function loadTextbookLibrary(): TextbookMeta[] {
  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as TextbookMeta[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function clearTextbookLibrary(): void {
  window.localStorage.removeItem(LIBRARY_KEY);
}
