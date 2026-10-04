import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ScheduledWhatsAppAlert } from '../types';
import { formatDateTime } from '../utils/format';
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  Users,
  XCircle
} from 'lucide-react';

const MESSAGE_TEMPLATES: Record<string, string> = {
  consecutive_absence: 'عزيزي الطالب {student_name}، نود تنبيهك بعدم إكمال {absence_count} محاضرات متتالية. يرجى متابعة الدروس والمحاضرات عبر المنصة للضرورة.',
  performance_drop: 'عزيزي الطالب {student_name}، لاحظنا انخفاض أدائك في الاختبارات الأخيرة بنسبة {drop_percent}%. نحن هنا لدعمك لتجاوز هذا التعثر.',
  quiz_reminder: 'تذكير عزيزي {student_name}: لديك كويز مجدول قريباً. يرجى المذاكرة الجيدة والاستعداد لدخول الاختبار في الموعد المحدّد.',
  enrollment_contact: 'أهلاً بك {student_name} في المنصة الأكاديمية! يسعدنا تواصلك بشأن طلب الانضمام للمقرر.',
  certificate_award: 'تهانينا عزيزي الطالب {student_name}! أُصدرت شهادتك بنجاح في المقرر الأكاديمي.',
  custom: 'عزيزي الطالب {student_name}، نود إحاطتك علماً بالتالي:'
};

const TYPES_LIST = [
  { key: 'consecutive_absence', label: 'إنذار غياب', Icon: AlertTriangle },
  { key: 'performance_drop', label: 'هبوط أداء', Icon: AlertTriangle },
  { key: 'quiz_reminder', label: 'تذكير كويز', Icon: Clock },
  { key: 'enrollment_contact', label: 'رسالة انضمام', Icon: MessageCircle }
] as const;

export const ScheduledWhatsAppPage: React.FC = () => {
  const {
    users,
    scheduledWhatsAppAlerts,
    scheduleWhatsAppAlert,
    cancelScheduledWhatsAppAlert,
    sendScheduledWhatsAppAlertNow,
    getStudentAnalytics
  } = useApp();

  const students = users.filter(u => u.role === 'student');

  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [messageType, setMessageType] = useState<ScheduledWhatsAppAlert['messageType']>('consecutive_absence');
  const [messageText, setMessageText] = useState<string>(MESSAGE_TEMPLATES['consecutive_absence']);
  const [scheduledFor, setScheduledFor] = useState<string>(() => {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    return nextHour.toISOString().slice(0, 16);
  });

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent' | 'cancelled' | 'failed'>('all');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleTypeChange = (type: ScheduledWhatsAppAlert['messageType']) => {
    setMessageType(type);
    setMessageText(MESSAGE_TEMPLATES[type] || '');
  };

  const handleQuickTime = (hoursFromNow: number) => {
    const target = new Date();
    target.setHours(target.getHours() + hoursFromNow);
    if (hoursFromNow >= 24) {
      target.setMinutes(0);
    }
    setScheduledFor(target.toISOString().slice(0, 16));
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !messageText.trim() || !scheduledFor) return;

    setSubmitting(true);
    try {
      const student = students.find(s => s.id === selectedStudentId);
      const analytics = student ? getStudentAnalytics(student.id) : null;

      let processed = messageText;
      if (student) {
        processed = processed.replace(/{student_name}/g, student.name);
      }
      if (analytics) {
        processed = processed.replace(/{absence_count}/g, String(analytics.consecutiveAbsences || 2));
        processed = processed.replace(/{drop_percent}/g, String(analytics.performanceDropPercentage || 15));
      }

      scheduleWhatsAppAlert({
        studentId: selectedStudentId,
        messageType,
        messageText: processed,
        scheduledFor
      });

      setActionSuccess('تم جدولة إرسال التنبيه عبر واتساب بنجاح! 🚀');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAlerts = scheduledWhatsAppAlerts.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  const pendingCount = scheduledWhatsAppAlerts.filter(a => a.status === 'pending').length;
  const sentCount = scheduledWhatsAppAlerts.filter(a => a.status === 'sent').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">جدولة تنبيهات واتساب</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تحديد مواعيد مسبقة لإرسال رسائل التذكير والإنذارات التلقائية عبر واتساب للطلاب
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>قيد الانتظار: {pendingCount}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>تم إرسالها: {sentCount}</span>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl text-emerald-900 dark:text-emerald-200 text-sm font-bold flex items-center gap-2 animate-fade">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Form: Schedule New Alert */}
        <div className="lg:col-span-5 space-y-6">
          <div className="surface p-6 space-y-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">جدولة تنبيه جديد</h3>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              {/* Target Student */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>الطالب المستهدف</span>
                </label>
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  className="w-full text-xs font-bold p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                  required
                >
                  {students.map(s => {
                    const a = getStudentAnalytics(s.id);
                    const hasAlarm = a?.hasAbsenceAlarm || a?.hasPerformanceAlarm;
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.academicId}) {hasAlarm ? '⚠️ يلزمه تنبيه' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Message Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع الرسالة
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES_LIST.map(({ key: typeKey, label: labelText, Icon }) => {
                    const active = messageType === typeKey;
                    return (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() => handleTypeChange(typeKey as any)}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-start flex items-center gap-2 transition-all ${
                          active
                            ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                        <span className="truncate">{labelText}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Content */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نص الرسالة (قابل للتخصيص)
                  </label>
                </div>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 leading-relaxed"
                  placeholder="أدخل نص الرسالة..."
                  required
                />
              </div>

              {/* Scheduled Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>وقت الإرسال المجدول</span>
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={e => setScheduledFor(e.target.value)}
                  className="w-full text-xs font-bold p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                  required
                />
                
                {/* Preset Timing Shortcuts */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => handleQuickTime(1)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold"
                  >
                    + بعد ساعة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTime(3)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold"
                  >
                    + بعد 3 ساعات
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTime(24)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold"
                  >
                    غداً نفس الوقت
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTime(72)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold"
                  >
                    بعد 3 أيام
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <CalendarClock className="w-4 h-4" />
                <span>جدولة التنبيه الآن</span>
              </button>
            </form>
          </div>
        </div>

        {/* List: Scheduled Items & Filters */}
        <div className="lg:col-span-7 space-y-6">
          <div className="surface p-6 space-y-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>سجل التنبيهات المجدولة ({filteredAlerts.length})</span>
              </h3>

              {/* Status Tabs */}
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                {[
                  ['all', 'الكل'],
                  ['pending', 'قيد الانتظار'],
                  ['sent', 'تم الإرسال'],
                  ['cancelled', 'ملغى']
                ].map(([tabKey, tabLabel]) => (
                  <button
                    key={tabKey}
                    onClick={() => setStatusFilter(tabKey as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === tabKey
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tabLabel}
                  </button>
                ))}
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-3">
                <CalendarClock className="w-12 h-12 mx-auto stroke-1 text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-bold">لا توجد تنبيهات مجدولة ضمن هذه الفئة.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map(item => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {item.studentName}
                        </span>
                        <span className="text-[11px] text-slate-400" dir="ltr">
                          ({item.phone})
                        </span>
                      </div>

                      {/* Status badge */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                          item.status === 'pending'
                            ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            : item.status === 'sent'
                            ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {item.status === 'pending' && <Clock className="w-3 h-3 animate-pulse" />}
                        {item.status === 'sent' && <CheckCircle2 className="w-3 h-3" />}
                        {item.status === 'cancelled' && <XCircle className="w-3 h-3" />}
                        {item.status === 'pending'
                          ? 'قيد الانتظار'
                          : item.status === 'sent'
                          ? 'تم الإرسال'
                          : 'ملغى'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 leading-relaxed whitespace-pre-line">
                      {item.messageText}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
                      <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>موعد الإرسال:</span>
                        <strong className="text-slate-700 dark:text-slate-300">{formatDateTime(item.scheduledFor)}</strong>
                      </div>

                      {item.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => sendScheduledWhatsAppAlertNow(item.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>إرسال الآن</span>
                          </button>
                          <button
                            onClick={() => cancelScheduledWhatsAppAlert(item.id)}
                            className="px-2 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>إلغاء</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
