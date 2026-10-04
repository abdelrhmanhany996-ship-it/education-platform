import React, { useRef, useState } from 'react';
import { User, Certificate } from '../types';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/format';
import {
  Award,
  CheckCircle2,
  Download,
  Loader2,
  Printer,
  Sparkles,
  X,
  MessageCircle,
  Send,
  UserCheck
} from 'lucide-react';

interface QuickCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudent?: User | null;
}

const Seal: React.FC<{ code: string; year: string }> = ({ code, year }) => (
  <svg viewBox="0 0 120 120" className="w-20 h-20" role="img" aria-label="ختم معتمد">
    <defs>
      <path id="quick-seal-top" d="M 60 60 m -42 0 a 42 42 0 1 1 84 0" />
      <path id="quick-seal-bottom" d="M 60 60 m -42 0 a 42 42 0 0 0 84 0" />
    </defs>
    <circle cx="60" cy="60" r="56" fill="none" stroke="#9a6b1f" strokeWidth="3" />
    <circle cx="60" cy="60" r="50" fill="#fbf1dc" stroke="#9a6b1f" strokeWidth="1" />
    <circle cx="60" cy="60" r="30" fill="none" stroke="#9a6b1f" strokeWidth="1" strokeDasharray="2 3" />
    <text fontSize="9" fontWeight="700" fill="#7a5216" fontFamily="Cairo, sans-serif">
      <textPath href="#quick-seal-top" startOffset="50%" textAnchor="middle">
        ختم معتمد
      </textPath>
    </text>
    <text fontSize="8" fontWeight="700" fill="#7a5216" fontFamily="Cairo, sans-serif">
      <textPath href="#quick-seal-bottom" startOffset="50%" textAnchor="middle">
        {code}
      </textPath>
    </text>
    <path d="M60 40 l6 13 14 2 -10 10 3 14 -13 -7 -13 7 3 -14 -10 -10 14 -2z" fill="#b7791f" />
    <text x="60" y="88" textAnchor="middle" fontSize="8" fontWeight="700" fill="#7a5216" fontFamily="Cairo, sans-serif">
      {year}
    </text>
  </svg>
);

export const QuickCertificateModal: React.FC<QuickCertificateModalProps> = ({
  isOpen,
  onClose,
  initialStudent
}) => {
  const { users, courses, currentUser, certSettings, createCertificate, sendTelegramMessage } = useApp();
  const paperRef = useRef<HTMLDivElement>(null);

  const students = users.filter(u => u.role === 'student');
  const doctorCourses = courses.filter(c => c.doctorId === currentUser?.id || !currentUser?.id) ;

  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudent?.id || students[0]?.id || '');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(doctorCourses[0]?.id || '');
  const [rankTitle, setRankTitle] = useState<string>('📜 شهادة تقدير وتميز');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [issuedCert, setIssuedCert] = useState<Certificate | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  if (!isOpen) return null;

  const targetStudent = users.find(u => u.id === selectedStudentId) || initialStudent || students[0];
  const targetCourse = courses.find(c => c.id === selectedCourseId) || doctorCourses[0];

  const finalRankTitle = rankTitle === 'custom' ? (customTitle.trim() || 'شهادة تقدير') : rankTitle;

  const handleIssue = () => {
    if (!targetStudent || !targetCourse) return;
    const cert = createCertificate({
      studentId: targetStudent.id,
      studentName: targetStudent.name,
      studentAcademicId: targetStudent.academicId,
      courseId: targetCourse.id,
      courseTitle: targetCourse.title,
      courseCode: targetCourse.code,
      rankTitle: finalRankTitle,
      totalPoints: 100
    });
    setIssuedCert(cert);
    setStatusMsg('تمت جني وسجل الشهادة بنجاح للمنظومة!');
  };

  const downloadPdf = async () => {
    if (!paperRef.current) return;
    setBusy(true);
    setStatusMsg('');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf')
      ]);
      const canvas = await html2canvas(paperRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(w / canvas.width, h / canvas.height);
      const iw = canvas.width * ratio;
      const ih = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (w - iw) / 2, (h - ih) / 2, iw, ih);
      pdf.save(`certificate-${targetStudent?.academicId || 'student'}.pdf`);
      setStatusMsg('تم تحميل ملف الـ PDF بنجاح.');
    } catch {
      setStatusMsg('استخدم زر الطباعة واختر "حفظ كـ PDF".');
    } finally {
      setBusy(false);
    }
  };

  const sendWhatsApp = () => {
    if (!targetStudent?.phone) return;
    const code = issuedCert?.certificateCode || 'CERT-PREVIEW';
    const text = `ألف مبارك ${targetStudent.name}! حصلت على (${finalRankTitle}) في مقرر ${targetCourse?.title || 'المقرر الأكاديمي'}. كود التحقق: ${code}`;
    window.open(
      `https://wa.me/${targetStudent.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const sendTelegram = async () => {
    if (!targetStudent) return;
    const code = issuedCert?.certificateCode || 'CERT-PREVIEW';
    const text = `🎉 ألف مبارك يا ${targetStudent.name}!\n\nتم إصدار ${finalRankTitle} الخاصة بك في مقرر "${targetCourse?.title}".\nكود التحقق: ${code}`;
    try {
      await sendTelegramMessage(targetStudent.id, 'certificate_award', text);
      setStatusMsg('تم إرسال إشعار الشهادة للطالب عبر التليجرام!');
    } catch {
      setStatusMsg('فشل الإرسال، تأكد أن الطالب رابط حسابه بالتليجرام.');
    }
  };

  const year = String(new Date().getFullYear());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-6 animate-pop">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 font-bold text-sm">
            <Award className="w-5 h-5 text-amber-400" />
            <span>قالب إنشاء وإرسال الشهادة السريع</span>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اختر الطالب Target Student:</label>
              <select
                value={selectedStudentId}
                onChange={e => {
                  setSelectedStudentId(e.target.value);
                  setIssuedCert(null);
                }}
                className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold"
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.academicId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المقرر الأكاديمي Course:</label>
              <select
                value={selectedCourseId}
                onChange={e => {
                  setSelectedCourseId(e.target.value);
                  setIssuedCert(null);
                }}
                className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold"
              >
                {doctorCourses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نوع الشهادة / اللقب Certificate Type:</label>
              <select
                value={rankTitle}
                onChange={e => {
                  setRankTitle(e.target.value);
                  setIssuedCert(null);
                }}
                className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold"
              >
                <option value="🥇 المركز الأول">🥇 المركز الأول</option>
                <option value="🥈 المركز الثاني">🥈 المركز الثاني</option>
                <option value="🥉 المركز الثالث">🥉 المركز الثالث</option>
                <option value="🌟 الطالب المثالي والأنشط">🌟 الطالب المثالي والأنشط</option>
                <option value="📜 شهادة تقدير وتميز">📜 شهادة تقدير وتميز</option>
                <option value="🎓 شهادة اتمام المقرر بنجاح">🎓 شهادة اتمام المقرر بنجاح</option>
                <option value="custom">✍️ عنوان مخصص...</option>
              </select>
            </div>
          </div>

          {rankTitle === 'custom' && (
            <div>
              <input
                type="text"
                placeholder="اكتب عنوان الشهادة المخصص هنا..."
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-bold"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={handleIssue}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              إصدار وتثبيت الشهادة للطالب
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadPdf}
                disabled={busy}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                تنزيل PDF
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                طباعة
              </button>

              <button
                onClick={sendWhatsApp}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                واتساب
              </button>

              <button
                onClick={sendTelegram}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-4 h-4" />
                تليجرام
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="p-2.5 text-xs text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/25 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Live Certificate Canvas */}
        <div className="p-4 md:p-8 bg-slate-100 dark:bg-slate-800 flex justify-center">
          <div
            id="quick-certificate-paper"
            ref={paperRef}
            className="w-full max-w-3xl bg-linear-to-b from-[#FFFDF9] via-[#FAF6EE] to-[#FFFDF9] border-[10px] border-double border-amber-800/40 rounded-2xl p-6 md:p-10 relative text-center text-slate-900 select-none overflow-hidden"
            style={{ minHeight: 480 }}
          >
            <div className="absolute top-3 right-3 w-10 h-10 border-t-2 border-r-2 border-amber-700/60 rounded-tr-lg" />
            <div className="absolute top-3 left-3 w-10 h-10 border-t-2 border-l-2 border-amber-700/60 rounded-tl-lg" />
            <div className="absolute bottom-3 right-3 w-10 h-10 border-b-2 border-r-2 border-amber-700/60 rounded-br-lg" />
            <div className="absolute bottom-3 left-3 w-10 h-10 border-b-2 border-l-2 border-amber-700/60 rounded-bl-lg" />

            <div className="space-y-1 mb-4">
              <div className="text-[12px] font-bold text-amber-900 tracking-widest">
                {certSettings.institutionName || 'المنصة الأكاديمية التعليمية'}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-amber-950 tracking-tight">شهادة تفوّق وتكريم</h1>
              <div className="w-32 h-0.5 bg-linear-to-r from-transparent via-amber-600 to-transparent mx-auto mt-2" />
            </div>

            <div className="space-y-4 my-6 text-sm leading-relaxed text-slate-800">
              <p className="text-slate-600 text-xs">تشهد إدارة المقرر وأستاذه بأن الطالب / الطالبة:</p>

              <div className="py-1">
                <div className="text-2xl md:text-3xl font-black text-slate-950 border-b border-dashed border-amber-700/30 inline-block px-8 pb-1">
                  {targetStudent?.name || 'اسم الطالب'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  الرقم الأكاديمي: <bdi dir="ltr">{targetStudent?.academicId || '000000'}</bdi>
                </div>
              </div>

              <p className="max-w-lg mx-auto text-xs md:text-sm text-slate-700">
                أتمّ بنجاح مادتَي ومتطلبات مقرر{' '}
                <strong className="text-slate-900">
                  "{targetCourse?.title || 'المقرر الأكاديمي'}" (<bdi dir="ltr">{targetCourse?.code || 'CRS-101'}</bdi>)
                </strong>{' '}
                واستحق عن جدارة:
              </p>

              <div className="inline-block bg-amber-100/70 border border-amber-300/80 rounded-2xl px-6 py-2">
                <div className="text-amber-900 font-black text-lg flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>{finalRankTitle}</span>
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-amber-900/20 grid grid-cols-3 items-end gap-2 text-xs">
              <div className="text-center space-y-1">
                <div className="h-12 flex items-end justify-center">
                  {certSettings.signatureDataUrl ? (
                    <img src={certSettings.signatureDataUrl} alt="توقيع الدكتور" className="max-h-12 max-w-full object-contain" />
                  ) : (
                    <div className="font-serif italic text-xl text-slate-700">{currentUser?.name || 'أستاذ المقرر'}</div>
                  )}
                </div>
                <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 text-xs">{currentUser?.name || 'أستاذ المقرر'}</div>
                <div className="text-[11px] text-slate-500">أستاذ المقرر</div>
              </div>

              <div className="flex justify-center">
                <Seal code={targetCourse?.code || 'CRS-101'} year={year} />
              </div>

              <div className="text-center space-y-1">
                <div className="text-[11px] text-slate-600 font-bold">تاريخ الإصدار</div>
                <div className="text-xs text-slate-800">{formatDate(new Date().toISOString())}</div>
                <div className="text-[11px] text-slate-500">
                  كود التحقق: <bdi dir="ltr">{issuedCert?.certificateCode || 'CERT-PREVIEW'}</bdi>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
