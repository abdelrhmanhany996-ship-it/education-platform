import { useCallback, useEffect, useRef } from 'react';
import { api, ApiError, SyncDoc } from './api';

export interface SyncedCollection {
  name: string;
  items: SyncDoc[];
  set: (docs: any[]) => void;
}

/** JSON with sorted keys, without the server-only `_ts`, so equal documents compare equal. */
function norm(doc: SyncDoc): string {
  const sort = (v: any): any =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .filter(k => k !== '_ts')
            .sort()
            .map(k => [k, sort(v[k])])
        )
      : v;
  return JSON.stringify(sort(doc));
}

const NEWEST_FIRST = new Set(['activityLogs', 'whatsappLogs']);
const orderFor = (name: string, docs: SyncDoc[]) => (NEWEST_FIRST.has(name) ? [...docs].reverse() : docs);

interface Options {
  /** Sync only while signed in and not previewing a student. */
  active: boolean;
  collections: SyncedCollection[];
  onState: (s: 'idle' | 'saving' | 'offline') => void;
  pollMs?: number;
}

/**
 * Keeps the in-memory data and the database in step.
 *  - local edits: diffed per document and sent to /api/sync (debounced)
 *  - other people's edits: pulled every few seconds when there is nothing unsent
 */
export function useServerSync({ active, collections, onState, pollMs = 12000 }: Options) {
  const base = useRef<Record<string, Map<string, string>>>({});
  const busy = useRef(false);
  const latest = useRef(collections);
  latest.current = collections;
  const retry = useRef<number | undefined>(undefined);

  const setBase = (name: string, docs: SyncDoc[]) => {
    base.current[name] = new Map(docs.map(d => [d.id, norm(d)]));
  };

  const diff = (c: SyncDoc[], name: string) => {
    const known = base.current[name] || new Map<string, string>();
    const upserts: SyncDoc[] = [];
    const seen = new Set<string>();
    for (const d of c) {
      seen.add(d.id);
      if (known.get(d.id) !== norm(d)) upserts.push(d);
    }
    const deletes = [...known.keys()].filter(id => !seen.has(id));
    return { upserts, deletes };
  };

  const pending = () => latest.current.some(c => {
    const d = diff(c.items, c.name);
    return d.upserts.length || d.deletes.length;
  });

  const flush = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      for (const c of latest.current) {
        const { upserts, deletes } = diff(c.items, c.name);
        if (!upserts.length && !deletes.length) continue;
        onState('saving');
        await api.sync(c.name, upserts, deletes);
        const map = base.current[c.name] || (base.current[c.name] = new Map());
        upserts.forEach(d => map.set(d.id, norm(d)));
        deletes.forEach(id => map.delete(id));
      }
      onState('idle');
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 429) {
        // The server refused these edits (for example a student editing someone else's record).
        // Reload the server's version so the screen never shows something that was not saved.
        onState('idle');
        try {
          await pull(true);
        } catch {
          /* offline, the next poll will retry */
        }
      } else {
        onState('offline');
        window.clearTimeout(retry.current);
        retry.current = window.setTimeout(() => void flush(), 5000);
      }
    } finally {
      busy.current = false;
    }
  }, []);

  /** Replace local data with the server's. Skipped when there are unsent local edits, unless forced. */
  const pull = async (force = false) => {
    if (!force && (busy.current || pending())) return;
    const data = await api.bootstrap();
    const remote: Record<string, SyncDoc[]> = {
      users: data.users,
      courses: data.courses,
      groups: data.groups,
      studentStates: data.studentStates,
      certificates: data.certificates,
      activityLogs: data.activityLogs,
      whatsappLogs: data.whatsappLogs,
      chatMessages: data.chatMessages,
      settings: data.settings
    };
    for (const c of latest.current) {
      const docs = remote[c.name] || [];
      const remoteMap = new Map(docs.map(d => [d.id, norm(d)]));
      const known = base.current[c.name] || new Map<string, string>();
      const changed =
        remoteMap.size !== known.size || [...remoteMap].some(([id, n]) => known.get(id) !== n);
      if (changed || force) {
        setBase(c.name, docs);
        c.set(orderFor(c.name, docs));
      }
    }
  };

  // local edits -> server
  const deps = collections.map(c => c.items);
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => void flush(), 300);
    return () => window.clearTimeout(t);
  }, [active, ...deps]);

  // server -> local
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (!document.hidden) pull().catch(() => undefined);
    };
    const id = window.setInterval(tick, pollMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active, pollMs]);

  useEffect(() => () => window.clearTimeout(retry.current), []);

  return {
    /** Load a full server snapshot as the new baseline (after sign-in). */
    apply(data: Record<string, SyncDoc[]>) {
      for (const c of latest.current) {
        const docs = data[c.name] || [];
        setBase(c.name, docs);
        c.set(orderFor(c.name, docs));
      }
    },
    /** A document the server already has (created through its own endpoint): do not upload it again. */
    markSynced(name: string, doc: SyncDoc) {
      const map = base.current[name] || (base.current[name] = new Map());
      map.set(doc.id, norm(doc));
    },
    clear() {
      base.current = {};
    }
  };
}
