import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { User } from '../types';
import { api } from '../api';
import { chatUrl } from '../utils/whatsapp';
import {
  MessageCircle,
  Send,
  X,
  AlertTriangle,
  Award,
  Clock,
  CheckCircle2,
  Loader2,
  MessagesSquare
} from 'lucide-react';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: User | null;
  defaultType?: 'consecutive_absence' | 'performance_drop' | 'quiz_reminder' | 'certificate_award' | 'enrollment_contact';
  contextDetails?: {
    absenceCount?: number;
    dropPercentage?: number;
    courseTitle?: string;
    price?: number;
  };
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  student,
  defaultType = 'consecutive_absence',
  contextDetails
}) => {
  const { sendWhatsAppMessage, getMessageQuota, courses } = useApp();
  const [msgType, setMsgType] = useState(defaultType);
  const [customText, setCustomText] = useState<string>('');
  const [result, setResult] = useState<{ via?: 'text' | 'template' } | null>(null);
  const [sending, setSending] = useState(false);
  const [waInfo, setWaInfo] = useState<{ configured: boolean; template: boolean } | null>(null);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    setMsgType(defaultType);
    setResult(null);
    setSendError('');
  }, [student?.id, defaultType, isOpen]);

  // Is the server connected to WhatsApp Cloud API?
  useEffect(() => {
    if (!isOpen) return;
    api.whatsappStatus().then(setWaInfo).catch(() => setWaInfo(null));
  }, [isOpen]);

  const quota = student ? getMessageQuota(student.id, 'whatsapp') : null;

  const courseTitle = contextDetails?.courseTitle || courses[0]?.title || 'المقرر الدراسي';

  useEffect(() => {
    if (!student) return;

    if (msgType === 'consecutive_absence') {
      const absences = contextDetails?.absenceCount || 2;
      setCustomText(
        `السلام عليكم ورحمة الله يا ${student.name}،\nمعك دكتور المقرر لمادة (${courseTitle}).\nلوحظ عدم حضورك لـ (${absences}) محاضرات متتالية مؤخراً. أرجو الاطمئنان عليك والمبادرة بمراجعة المحاضرات المسجلة وحل الكويزات لضمان عدم تأثر درجاتك وترتيبك الأكاديمي.\nوفقك الله.`
      );
    } else if (msgType === 'performance_drop') {
      const drop = contextDetails?.dropPercentage || 25;
      setCustomText(
        `السلام عليكم ورحمة الله يا ${student.name}،\nمعك دكتور المقرر لمادة (${courseTitle}).\nلوحظ انخفاض في درجاتك بآخر كويز بنسبة (${drop}%) مقارنة بمتوسط أدائك السابق المتميز. هل تواجه صعوبة في فهم جزئية معينة؟ يمكنك التواصل معي خلال الساعات المكتبية أو طرح استفسارك بالمنصة للمساعدة.\nكل التوفيق.`
      );
    } else if (msgType === 'quiz_reminder') {
      setCustomText(
        `مرحباً ${student.name}،\nتذكير بمقرر (${courseTitle}):\nنافذة صلاحية الكويز الخاص بك قاربت على الانتهاء. يرجى الدخول للمنصة وإتمام تسليم الإجابات قبل إغلاق المؤقت.\nبالتوفيق.`
      );
    } else if (msgType === 'enrollment_contact') {
      const price = typeof contextDetails?.price === 'number' ? `\nسعر الكورس: ${contextDetails.price} ج.م.` : '';
      setCustomText(
        `السلام عليكم يا ${student.name}،\nبخصوص طلب تسجيلك في مقرر (${courseTitle}).${price}\nبرجاء التواصل معنا لإتمام الدفع وتفعيل حسابك.\nشكراً لك.`
      );
    } else if (msgType === 'certificate_award') {
      setCustomText(
        `ألف مبارك يا ${student.name}! 🌟\nيسرني إبلاغك بتحقيقك أحد المراكز الأولى في لوحة شرف مقرر (${courseTitle}) واستحقاقك درع التفوق وشهادة التميز الأكاديمي المعتمدة.\nيمكنك استعراض الشهادة وطباعتها الآن من حسابك بالمنصة.`
      );
    }
  }, [student, msgType, contextDetails, courseTitle]);

  if (!isOpen || !student) return null;

  // Direct send: the server delivers it through WhatsApp Cloud API, nothing opens.
  const handleSend = async () => {
    setSending(true);
    setSendError('');
    setResult(null);
    const res = await sendWhatsAppMessage(student.id, msgType, customText);
    setSending(false);
    if (res.success) setResult({ via: res.via });
    else setSendError(res.error || 'تعذر الإرسال');
  };

  // "شات الواتس": just opens the conversation in WhatsApp with the text ready
  const link = chatUrl(student.phone, customText);
  const openChat = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    else setSendError('رقم الطالب غير صالح، عدّله من بياناته.');
  };
  const canSend = !sending && !!customText.trim() && !!waInfo?.configured && (!quota || quota.canSend);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-emerald-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[12px] font-bold uppercase tracking-wider bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-md">
                التواصل والمتابعة الأكاديمية الفورية
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                إرسال تنبيه واتساب مباشر للطالب
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-emerald-800/60 hover:bg-emerald-800 text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {/* Student Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{student.name}</div>
              <div className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                الرقم الأكاديمي: {student.academicId}
              </div>
            </div>
            <div className="text-left">
              <span className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 px-2.5 py-1 rounded-lg font-mono">
                {student.phone}
              </span>
            </div>
          </div>

          {/* Type Selector */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800 dark:text-slate-200">نوع الإشعار والتنبيه:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMsgType('consecutive_absence')}
                className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex items-center gap-2 ${
                  msgType === 'consecutive_absence'
                    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-950 dark:text-rose-100 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>إنذار غياب متتالي</span>
              </button>

              <button
                type="button"
                onClick={() => setMsgType('performance_drop')}
                className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex items-center gap-2 ${
                  msgType === 'performance_drop'
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-100 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>متابعة هبوط درجات</span>
              </button>

              <button
                type="button"
                onClick={() => setMsgType('quiz_reminder')}
                className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex items-center gap-2 ${
                  msgType === 'quiz_reminder'
                    ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/40 text-blue-950 dark:text-blue-100 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>تذكير بموعد كويز</span>
              </button>

              <button
                type="button"
                onClick={() => setMsgType('certificate_award')}
                className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex items-center gap-2 ${
                  msgType === 'certificate_award'
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-100 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>تهنئة بتفوق ودرع</span>
              </button>
            </div>
          </div>

          {/* Text Area */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-800 dark:text-slate-200">
              نص الرسالة المجهز (قابل للتعديل قبل الإرسال):
            </label>
            <textarea
              rows={5}
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-600 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-200 leading-relaxed"
            />
          </div>

          {quota && (
            <div
              className={`rounded-xl p-3 border flex items-center gap-2 ${
                quota.canSend
                  ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-800 dark:text-rose-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {quota.canSend
                ? `رسائل هذا الأسبوع لهذا الطالب: ${quota.sentThisWeek} من ${quota.max}`
                : quota.reason}
            </div>
          )}

          {waInfo && !waInfo.configured && (
            <div className="rounded-xl p-3 border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold">الإرسال المباشر غير مفعّل بعد</div>
              <p className="text-[12px] leading-relaxed">
                أضف <span dir="ltr" className="font-mono">WHATSAPP_TOKEN</span> و <span dir="ltr" className="font-mono">WHATSAPP_PHONE_NUMBER_ID</span> في ملف
                <span dir="ltr" className="font-mono"> .env </span> ثم أعد تشغيل الخادم. في هذه الأثناء استخدم زر "شات الواتس".
              </p>
            </div>
          )}

          {sendError && (
            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl p-3 text-rose-800 dark:text-rose-300 leading-relaxed">
              {sendError}
            </div>
          )}

          {result && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl p-3 text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <span>
                تم إرسال الرسالة إلى {student.name}
                {result.via === 'template' && ' عبر القالب المعتمد (لأن آخر رسالة منه مرّ عليها أكثر من 24 ساعة)'}.
              </span>
            </div>
          )}
        </div>
        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 px-6 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            إلغاء
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="whatsapp-open-chat-btn"
              onClick={openChat}
              className="px-4 py-2 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2"
              title="يفتح المحادثة في واتساب برسالة جاهزة، بدون إرسال تلقائي"
            >
              <MessagesSquare className="w-4 h-4" />
              شات الواتس
            </button>

            <button
              id="whatsapp-send-btn"
              onClick={handleSend}
              disabled={!canSend}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'جارٍ الإرسال...' : 'إرسال'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};