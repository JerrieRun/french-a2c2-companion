import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { pushUserData } from './supabase';
import type { SyncKey } from './supabase';

/** localStorage 同步 state：惰性初始化 + 变化时持久化 */
export function useLocalStorageState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue];
}

/** 登录后把某个学习记录防抖上传云端（800ms），并回调同步状态 */
export function useDebouncedCloudSync<T>(
  key: SyncKey,
  value: T,
  enabled: boolean,
  onStatus: (s: 'syncing' | 'synced' | 'error') => void,
  delay = 800
) {
  useEffect(() => {
    if (!enabled) return;
    onStatus('syncing');
    const t = setTimeout(() => {
      void pushUserData(key, value)
        .then(() => onStatus('synced'))
        .catch(() => onStatus('error'));
    }, delay);
    return () => clearTimeout(t);
  }, [key, value, enabled, delay, onStatus]);
}
