import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, ExternalLink, Loader2, Mail, Phone, RefreshCw, Send, User } from 'lucide-react';

const input =
  'w-full text-sm p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500';
const label = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
const btnPrimary =
  'px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5';

export const StudentAccountPage: React.FC = () => {
  const { currentUser, updateStudent, linkTelegram, telegramInfo } = useApp();
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [saved, setSaved] = useState(false);

  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgError, setTgError] = useState('');

  if (!currentUser) return null;
  const linked = !!currentUser.telegramChatId;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateStudent(currentUser.id, { phone: phone.trim(), email: email.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const startLink = async () => {
    setTgBusy(true);
    setTgError('');
    const r = await linkTelegram();
    setTgBusy(false);
    if (r.linked) {
      setDeepLink(null);
      return;
    }
    if (r.deepLink) setDeepLink(r.deepLink);
    else setTgError(r.error || 'تعذر إنشاء رابط الربط');
  };

  const checkAgain = async () => {
    setTgBusy(true);
    const r = await linkTelegram();
    setTgBusy(false);
    if (r.linked) setDeepLink(null);
    else setTgError('لم تربط الحساب بعد. اضغط الرابط ثم ابدأ محادثة مع البوت.');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">حسابي</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">بيانات التواصل، وربط تليجرام لاستقبال التنبيهات هناك.</p>
      </div>

      <form onSubmit={save} className="surface p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          البيانات الأساسية
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <span className={label}>
              <Phone className="w-3.5 h-3.5 inline ms-1" />
              رقم الهاتف (واتساب)
            </span>
            <input className={`${input} text-left`} dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <span className={label}>
              <Mail className="w-3.5 h-3.5 inline ms-1" />
              البريد الإلكتروني
            </span>
            <input className={`${input} text-left`} dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        {saved && (
          <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </div>
        )}
        <button className={btnPrimary}>حفظ</button>
      </form>

      <section className="surface p-5 space-y-4">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          ربط تليجرام
        </h3>

        {linked ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
            <CheckCircle2 className="w-5 h-5" />
            حسابك مربوط بتليجرام، ستصلك تنبيهات الدكتور هناك.
          </div>
        ) : telegramInfo && !telegramInfo.bot ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">ربط تليجرام غير متاح على هذه المنصة حالياً.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              اضغط "إنشاء رابط ربط"، ثم افتح الرابط في تليجرام واضغط Start.
            </p>
            {!deepLink ? (
              <button onClick={startLink} disabled={tgBusy} className={btnPrimary}>
                {tgBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إنشاء رابط ربط
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  فتح تليجرام والربط
                </a>
                <button onClick={checkAgain} disabled={tgBusy} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  {tgBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  تحقق من الربط
                </button>
              </div>
            )}
            {tgError && <p className="text-xs text-rose-600 dark:text-rose-400">{tgError}</p>}
          </div>
        )}
      </section>
    </div>
  );
};
