import type { MaterialPreview } from '../types';

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
