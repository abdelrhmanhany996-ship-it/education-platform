import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Check, Plus, X } from 'lucide-react';

interface Props {
  value: string[];
  onChange: (subjects: string[]) => void;
  /** Extra suggestions (e.g. the departments picked above), shown before the existing courses' subjects. */
  suggestions?: string[];
  id?: string;
  inputClassName?: string;
}

const MAX = 10;
const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 80);

/** Pick several subjects: tap suggestions (subjects already on the platform) or type new ones. */
export const SubjectPicker: React.FC<Props> = ({ value, onChange, suggestions = [], id, inputClassName = '' }) => {
  const [draft, setDraft] = useState('');
  const [catalog, setCatalog] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .catalog()
      .then(list => alive && setCatalog([...new Set(list.map(c => c.title))]))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const has = (s: string) => value.some(v => v.toLowerCase() === s.toLowerCase());
  const options = useMemo(
    () => [...new Set([...suggestions, ...catalog].map(clean).filter(Boolean))].filter(s => !has(s)).slice(0, 24),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, catalog, value]
  );

  const add = (raw: string) => {
    const parts = raw.split(/[,،\n]/).map(clean).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some(v => v.toLowerCase() === p.toLowerCase()) && next.length < MAX) next.push(p);
    onChange(next);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="المواد المختارة">
          {value.map(s => (
            <li
              key={s}
              className="inline-flex items-center gap-1 ps-2.5 pe-1 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold"
            >
              <Check className="w-3 h-3" />
              {s}
              <button
                type="button"
                onClick={() => onChange(value.filter(v => v !== s))}
                aria-label={`إزالة ${s}`}
                className="p-0.5 rounded hover:bg-white/20"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={e => {
            const v = e.target.value;
            if (/[,،]/.test(v)) add(v);
            else setDraft(v);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (draft.trim()) add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          disabled={value.length >= MAX}
          placeholder={value.length >= MAX ? `الحد الأقصى ${MAX} مواد` : 'اكتب اسم مادة واضغط Enter'}
          className={`flex-1 min-w-0 ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => draft.trim() && add(draft)}
          disabled={!draft.trim()}
          aria-label="إضافة المادة"
          className="shrink-0 px-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {options.length > 0 && value.length < MAX && (
        <div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">اقتراحات (اضغط للإضافة):</div>
          <div className="flex flex-wrap gap-1.5">
            {options.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              >
                <Plus className="w-3 h-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
