import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import { CheckCircle2, Loader2, Send } from 'lucide-react';

const input =
  'w-full text-sm p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500';
const btn =
  'px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5';

/** Settings card: link the doctor's personal Telegram account so messages reach any number, no bot Start needed. */
export const TelegramAccountCard: React.FC = () => {
  const { refreshTelegramInfo } = useApp();
  const [st, setSt] = useState<{ configured: boolean; connected: boolean; name?: string } | null>(null);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.telegramAccount().then(setSt).catch(() => setSt(null));
  useEffect(() => {
    void load();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await api.telegramAccountCode(phone);
      setStep('code');
    });

  const verify = () =>
    run(async () => {
      const r = await api.telegramAccountVerify(code, needsPassword ? password : undefined);
      if (r.needsPassword) {
        setNeedsPassword(true);
        return;
      }
      setStep('phone');
      setCode('');
      setPassword('');
      setNeedsPassword(false);
      await load();
      refreshTelegramInfo();
    });

  const disconnect = () =>
    run(async () => {
      await api.telegramAccountLogout();
      await load();
      refreshTelegramInfo();
    });

  return (
    <section className="surface p-5 space-y-4">
      <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <Send className="w-4 h-4 text-sky-600" />
        حساب تليجرام الشخصي (رسائل مباشرة بدون بوت)
      </h3>

      {!st ? (
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      ) : !st.configured ? (
        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
          <p>عشان المنصة تبعت من حسابك لأي رقم، محتاج مرة واحدة:</p>
          <ol className="list-decimal ps-5 space-y-1">
            <li>
              افتح <span dir="ltr" className="font-mono">my.telegram.org</span> وسجّل دخول برقمك، ثم <b>API development tools</b> وأنشئ تطبيق (أي اسم).
            </li>
            <li>
              انسخ <span dir="ltr" className="font-mono">api_id</span> و <span dir="ltr" className="font-mono">api_hash</span> في ملف <span dir="ltr" className="font-mono">.env</span>:
              <div dir="ltr" className="font-mono text-xs bg-slate-100 dark:bg-slate-800 rounded-lg p-2 mt-1">
                TELEGRAM_API_ID=123456
                <br />
                TELEGRAM_API_HASH=abcdef...
              </div>
            </li>
            <li>أعد تشغيل الخادم وارجع هنا لتسجيل الدخول.</li>
          </ol>
        </div>
      ) : st.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            مربوط: {st.name}
          </div>
          <button onClick={disconnect} disabled={busy} className="px-4 py-2 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold">
            فصل الحساب
          </button>
        </div>
      ) : step === 'phone' ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">اكتب رقم موبايلك المسجّل على تليجرام، وهيوصلك كود دخول داخل تطبيق تليجرام.</p>
          <div className="flex gap-2">
            <input className={input} dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01012345678" />
            <button onClick={sendCode} disabled={busy || !phone.trim()} className={btn}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              إرسال الكود
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">اكتب الكود اللي وصلك على تليجرام.</p>
          <div className="flex flex-wrap gap-2">
            <input className={`${input} max-w-44`} dir="ltr" value={code} onChange={e => setCode(e.target.value)} placeholder="12345" />
            {needsPassword && (
              <input className={`${input} max-w-56`} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة مرور التحقق بخطوتين" />
            )}
            <button onClick={verify} disabled={busy || !code.trim() || (needsPassword && !password)} className={btn}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              ربط
            </button>
            <button onClick={() => setStep('phone')} className="text-xs font-bold text-slate-500">
              رجوع
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 rounded-xl px-3 py-2">{error}</div>}

      <p className="text-[12px] text-slate-500 dark:text-slate-400">
        تنبيه: تليجرام بيقيّد الحسابات اللي بتبعت رسائل كتير لأرقام جديدة. استخدمها للتواصل الفعلي مع طلابك (مش رسائل جماعية)، والمنصة
        بتلتزم بحد الرسائل الأسبوعي. الجلسة محفوظة على جهازك فقط.
      </p>
    </section>
  );
};
