import React, { useCallback, useEffect, useState } from 'react';
import { api, DoctorRequest } from '../api';
import { formatDateTime } from '../utils/format';
import { Check, Loader2, Mail, Phone, RefreshCw, UserCheck, X } from 'lucide-react';

/** Doctor accounts requested from the public signup, waiting for an existing doctor to approve them. */
export const DoctorRequestsCard: React.FC = () => {
  const [items, setItems] = useState<DoctorRequest[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [done, setDone] = useState('');
  const [subjects, setSubjects] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setError('');
    api
      .doctorRequests()
      .then(list => {
        setItems(list);
        setSubjects(Object.fromEntries(list.map(r => [r.id, r.requestedSubjects.join('، ')])));
      })
      .catch(e => setError(e instanceof Error ? e.message : 'تعذّر تحميل الطلبات'));
  }, []);

  useEffect(load, [load]);

  const act = async (r: DoctorRequest, approve: boolean) => {
    if (!approve && !window.confirm(`رفض طلب ${r.name} وحذفه؟`)) return;
    setBusyId(r.id);
    setError('');
    try {
      if (approve) {
        const list = (subjects[r.id] || '').split(/[,،\n]/).map(s => s.trim()).filter(Boolean);
        const res = await api.approveDoctor(r.id, list);
        setDone(`تم تفعيل حساب ${r.name}${res.subjects.length ? ` وإنشاء ${res.subjects.length} مقرر` : ''}`);
      } else {
        await api.rejectDoctor(r.id);
        setDone(`تم رفض طلب ${r.name}`);
      }
      setItems(prev => (prev || []).filter(x => x.id !== r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تنفيذ العملية');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="surface p-5 space-y-3" aria-labelledby="doctor-requests-title">
      <div className="flex items-center justify-between gap-2">
        <h3 id="doctor-requests-title" className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          طلبات حسابات الدكاترة
          {!!items?.length && (
            <span className="text-[11px] font-bold bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={load}
          aria-label="تحديث الطلبات"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        من يطلب حساب دكتور من صفحة التسجيل لا يستطيع الدخول قبل موافقتك. راجع المواد قبل القبول، ويُنشأ مقرر لكل مادة.
      </p>

      {done && <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-2.5">{done}</div>}
      {error && <div className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 rounded-xl p-2.5">{error}</div>}

      {items === null && !error ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        </div>
      ) : items && items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">لا توجد طلبات جديدة.</p>
      ) : (
        <ul className="space-y-3">
          {(items || []).map(r => (
            <li key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{r.name}</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <bdi dir="ltr">@{r.username}</bdi>
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /><bdi dir="ltr">{r.phone}</bdi></span>
                    <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /><bdi dir="ltr">{r.email}</bdi></span>
                  </div>
                  {(r.faculty || r.department) && (
                    <div className="text-[12px] text-slate-500 dark:text-slate-400">{[r.faculty, r.department].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
                {r.requestedAt && <span className="text-[11px] text-slate-400">{formatDateTime(r.requestedAt)}</span>}
              </div>
              <label className="block">
                <span className="block text-[12px] font-bold text-slate-700 dark:text-slate-300 mb-1">المواد (اختياري، تقدر تعدّلها قبل القبول)</span>
                <input
                  value={subjects[r.id] || ''}
                  onChange={e => setSubjects(s => ({ ...s, [r.id]: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!!busyId}
                  onClick={() => act(r, true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold"
                >
                  {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  قبول وتفعيل
                </button>
                <button
                  type="button"
                  disabled={!!busyId}
                  onClick={() => act(r, false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-60 text-xs font-bold"
                >
                  <X className="w-3.5 h-3.5" />
                  رفض
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
