import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { Send, X, AlertTriangle, Award, Clock, CheckCircle2, Loader2, MessageCircle } from 'lucide-react';

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User | null;
  defaultType?: 'consecutive_absence' | 'performance_drop' | 'quiz_reminder' | 'certificate_award' | 'enrollment_contact';
  contextDetails?: { absenceCount?: number; dropPercentage?: number; courseTitle?: string; price?: number };
}

export const TelegramModal: React.FC<TelegramModalProps> = ({ isOpen, onClose, student, defaultType = 'consecutive_absence', contextDetails }) => {
  const { sendTelegramMessage, getMessageQuota, courses, telegramInfo } = useApp();
  const [msgType, setMsgType] = useState(defaultType);
  const [customText, setCustomText] = useState('');
  const [result, setResult] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setMsgType(defaultType);
    setResult(false);
    setSendError('');
  }, [student?.id, defaultType, isOpen]);

  const quota = student ? getMessageQuota(student.id, 'telegram') : null;
  const courseTitle = contextDetails?.courseTitle || courses[0]?.title || 'المقرر الدراسي';

  const buildText = (type: typeof msgType) => {
    if (!student) return '';
    if (type === 'consecutive_absence') {
      const n = contextDetails?.absenceCount || 2;
      return `السلام عليكم يا ${student.name}،\nمعك أستاذ مقرر (${courseTitle}).\nلوحظ عدم حضورك لـ ${n} محاضرات متتالية. يرجى مراجعة المنصة والاطمئنان.`;
    }
    if (type === 'performance_drop') {
      const d = contextDetails?.dropPercentage || 25;
      return `السلام عليكم يا ${student.name}،\nمعك أستاذ مقرر (${courseTitle}).\nلوحظ انخفاض أدائك بنسبة ${d}% في آخر الكويزات. تواصل معنا إن احتجت مساعدة.`;
    }
    if (type === 'quiz_reminder') {
      return `مرحباً ${student.name}،\nتذكير بمقرر (${courseTitle}): نافذة الكويز قاربت على الانتهاء، أنهِ إجاباتك قبل الإغلاق.`;
    }
    if (type === 'enrollment_contact') {
      const price = typeof contextDetails?.price === 'number' ? `\nسعر الكورس: ${contextDetails.price} ج.م.` : '';
      return `السلام عليكم يا ${student.name}،\nبخصوص طلب تسجيلك في مقرر (${courseTitle}).${price}\nبرجاء التواصل معنا لإتمام الدفع وتفعيل حسابك.\nشكراً لك.`;
    }
    return `ألف مبارك يا ${student.name}! حققت أحد المراكز الأولى في مقرر (${courseTitle}) واستحققت شهادة تميز معتمدة.`;
  };

  useEffect(() => {
    if (student) setCustomText(buildText(msgType));
  }, [student, msgType, contextDetails, courseTitle]);

  // Nothing can be sent for this student (no linked personal account, student never started the bot):
  // open their Telegram chat directly by phone number and copy the message, instead of a dead form.
  const noSendPath = !!student && !student.telegramChatId && !!telegramInfo && !telegramInfo.userConnected;
  useEffect(() => {
    if (!isOpen || !student || !noSendPath) return;
    const digits = student.phone.replace(/\D/g, '');
    const intl = digits.startsWith('00') ? digits.slice(2) : digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
    navigator.clipboard?.writeText(buildText(defaultType)).catch(() => undefined);
    window.open(`https://t.me/+${intl}`, '_blank', 'noopener');
    setNote(`فُتحت محادثة تليجرام مع ${student.name} ونُسخت الرسالة، الصقها وأرسلها.`);
    setTimeout(() => setNote(''), 8000);
    onClose();
  }, [isOpen, student?.id, noSendPath]);

  if (!isOpen || !student || noSendPath) {
    return note ? (
      <div className="fixed bottom-4 start-4 z-40 bg-sky-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-bold max-w-sm">{note}</div>
    ) : null;
  }


  const handleSend = async () => {
    setSending(true);
    setSendError('');
    setResult(false);
    const res = await sendTelegramMessage(student.id, msgType, customText);
    setSending(false);
    if (res.success) setResult(true);
    else setSendError(res.error || 'تعذر الإرسال');
  };

  const linked = !!student.telegramChatId;
  const viaAccount = !!telegramInfo?.userConnected;
  const canSend = !sending && !!customText.trim() && !!telegramInfo?.configured && (linked || viaAccount) && (!quota || quota.canSend);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-8 animate-pop">
        <div className="bg-sky-600 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[12px] font-bold uppercase tracking-wider bg-sky-800 text-sky-100 px-2 py-0.5 rounded-md">
                رسالة تليجرام مباشرة
              </span>
              <h3 className="text-base font-bold mt-0.5">إرسال تنبيه للطالب عبر تليجرام</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-sky-800/60 hover:bg-sky-800 text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{student.name}</div>
              <div className="text-slate-500 dark:text-slate-400 mt-0.5">الرقم الأكاديمي: {student.academicId}</div>
            </div>
            <span
              className={`text-[12px] font-bold px-2.5 py-1 rounded-lg border ${
                linked || viaAccount
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25'
                  : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25'
              }`}
            >
              {viaAccount ? 'من حسابك الشخصي على تليجرام' : linked ? 'مرتبط بتليجرام' : 'لم يربط تليجرام بعد'}
            </span>
          </div>

          {!linked && !viaAccount && (
            <div className="rounded-xl p-3 border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200">
              اربط حسابك الشخصي على تليجرام من "الإعدادات" لإرسال أي رسالة مباشرة، أو اطلب من الطالب ربط البوت من "حسابي".
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800 dark:text-slate-200">نوع الإشعار:</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['consecutive_absence', 'إنذار غياب', AlertTriangle],
                  ['performance_drop', 'هبوط أداء', Clock],
                  ['quiz_reminder', 'تذكير كويز', Clock],
                  ['certificate_award', 'تهنئة', Award]
                ] as const
              ).map(([id, t, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMsgType(id)}
                  className={`p-2.5 rounded-xl border text-right transition flex items-center gap-2 ${
                    msgType === id
                      ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-300 dark:border-sky-500/40 text-sky-950 dark:text-sky-100 font-bold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {t}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={5}
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-800 dark:text-slate-200 leading-relaxed"
          />

          {quota && (
            <div className={`rounded-xl p-3 border flex items-center gap-2 ${quota.canSend ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-800 dark:text-rose-300'}`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {quota.canSend ? `رسائل هذا الأسبوع: ${quota.sentThisWeek} من ${quota.max}` : quota.reason}
            </div>
          )}

          {telegramInfo && !telegramInfo.configured && (
            <div className="rounded-xl p-3 border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200">
              بوت تليجرام غير مُعدّ على الخادم. أضف <span dir="ltr" className="font-mono">TELEGRAM_BOT_TOKEN</span> في ملف .env.
            </div>
          )}

          {sendError && <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl p-3 text-rose-800 dark:text-rose-300">{sendError}</div>}

          {result && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl p-3 text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              تم إرسال الرسالة عبر تليجرام.
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 px-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold">
            إلغاء
          </button>
          <button
            id="telegram-send-btn"
            onClick={handleSend}
            disabled={!canSend}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            {sending ? 'جارٍ الإرسال...' : 'إرسال عبر تليجرام'}
          </button>
        </div>
      </div>
    </div>
  );
};
