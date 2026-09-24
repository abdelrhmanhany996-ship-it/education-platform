import React, { useRef, useState } from 'react';
import { Certificate } from '../types';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/format';
import {
  Award,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Printer,
  Sparkles,
  X,
  MessageCircle
} from 'lucide-react';

interface CertificateModalProps {
  certificate: Certificate | null;
  isOpen: boolean;
  onClose: () => void;
  isDoctor: boolean;
  onApprove?: (certId: string) => void;
}

/** Round stamp drawn as SVG so it prints crisply and needs no external image. */
const Seal: React.FC<{ code: string; year: string }> = ({ code, year }) => (
  <svg viewBox="0 0 120 120" className="w-24 h-24" role="img" aria-label="ختم معتمد">
    <defs>
      <path id="seal-top" d="M 60 60 m -42 0 a 42 42 0 1 1 84 0" />
      <path id="seal-bottom" d="M 60 60 m -42 0 a 42 42 0 0 0 84 0" />
    </defs>
    <circle cx="60" cy="60" r="56" fill="none" stroke="#9a6b1f" strokeWidth="3" />
    <circle cx="60" cy="60" r="50" fill="#fbf1dc" stroke="#9a6b1f" strokeWidth="1" />
    <circle cx="60" cy="60" r="30" fill="none" stroke="#9a6b1f" strokeWidth="1" strokeDasharray="2 3" />
    <text fontSize="9" fontWeight="700" fill="#7a5216" fontFamily="Cairo, sans-serif">
      <textPath href="#seal-top" startOffset="50%" textAnchor="middle">
        ختم معتمد
      </textPath>
    </text>
    <text fontSize="8" fontWeight="700" fill="#7a5216" fontFamily="Cairo, sans-serif">
      <textPath href="#seal-bottom" startOffset="50%" textAnchor="middle">
        {code}
      </textPath>
    </text>
    <path d="M60 40 l6 13 14 2 -10 10 3 14 -13 -7 -13 7 3 -14 -10 -10 14 -2z" fill="#b7791f" />
    <text x="60" y="88" textAnchor="middle" fontSize="8" fontWeight="700" fill="#7a5216" fontFamily="Cairo, sans-serif">
      {year}
    </text>
  </svg>
);

export const CertificateModal: React.FC<CertificateModalProps> = ({
  certificate,
  isOpen,
  onClose,
  isDoctor,
  onApprove
}) => {
  const { certSettings, users } = useApp();
  const paperRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !certificate) return null;

  const isApproved = certificate.status === 'approved' || certificate.status === 'issued';
  const student = users.find(u => u.id === certificate.studentId);
  const year = certificate.issueDate?.slice(0, 4) || String(new Date().getFullYear());

  const downloadPdf = async () => {
    if (!paperRef.current) return;
    setBusy(true);
    setError('');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf')
      ]);
      // Capture in light mode regardless of the app theme
      const canvas = await html2canvas(paperRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(w / canvas.width, h / canvas.height);
      const iw = canvas.width * ratio;
      const ih = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (w - iw) / 2, (h - ih) / 2, iw, ih);
      pdf.save(`certificate-${certificate.studentAcademicId}.pdf`);
    } catch {
      setError('تعذر إنشاء ملف PDF. استخدم زر الطباعة ثم اختر "حفظ كـ PDF".');
    } finally {
      setBusy(false);
    }
  };

  const shareOnWhatsApp = () => {
    if (!student?.phone) return;
    const text = `ألف مبارك ${certificate.studentName}! حصلت على ${certificate.rankTitle} في مقرر ${certificate.courseTitle}. كود التحقق: ${certificate.certificateCode}`;
    window.open(
      `https://wa.me/${student.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-8 animate-pop">
        <div data-no-print className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Award className="w-4 h-4 text-amber-400" />
            <span>شهادة تفوق</span>
            {isApproved ? (
              <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30 flex items-center gap-1 text-[12px]">
                <CheckCircle2 className="w-3 h-3" />
                معتمدة
              </span>
            ) : (
              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1 text-[12px]">
                <Clock className="w-3 h-3" />
                بانتظار اعتماد الدكتور
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDoctor && !isApproved && onApprove && (
              <button
                onClick={() => onApprove(certificate.id)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                اعتماد وإصدار
              </button>
            )}
            {(isApproved || isDoctor) && (
              <>
                <button
                  onClick={downloadPdf}
                  disabled={busy}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  تنزيل PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة
                </button>
              </>
            )}
            {isDoctor && isApproved && (
              <button
                onClick={shareOnWhatsApp}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                title="يفتح واتساب برسالة تهنئة. أرفق ملف الـ PDF يدوياً."
              >
                <MessageCircle className="w-3.5 h-3.5" />
                إرسال
              </button>
            )}
            <button onClick={onClose} aria-label="إغلاق" className="p-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div data-no-print className="px-5 py-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-b border-rose-200 dark:border-rose-500/25">
            {error}
          </div>
        )}

        {/* The paper is always light, in dark mode and in print */}
        <div className="p-4 md:p-10 bg-slate-100 dark:bg-slate-800 flex justify-center force-light">
          <div
            id="certificate-print"
            ref={paperRef}
            className="w-full max-w-3xl bg-linear-to-b from-[#FFFDF9] via-[#FAF6EE] to-[#FFFDF9] border-[10px] border-double border-amber-800/40 rounded-2xl p-6 md:p-12 relative text-center text-slate-900 dark:text-slate-100 select-none overflow-hidden"
            style={{ minHeight: 520 }}
          >
            <div className="absolute top-3 right-3 w-12 h-12 border-t-2 border-r-2 border-amber-700/60 rounded-tr-lg" />
            <div className="absolute top-3 left-3 w-12 h-12 border-t-2 border-l-2 border-amber-700/60 rounded-tl-lg" />
            <div className="absolute bottom-3 right-3 w-12 h-12 border-b-2 border-r-2 border-amber-700/60 rounded-br-lg" />
            <div className="absolute bottom-3 left-3 w-12 h-12 border-b-2 border-l-2 border-amber-700/60 rounded-bl-lg" />

            <div className="space-y-1 mb-6">
              <div className="text-[12px] font-bold text-amber-900 dark:text-amber-200 tracking-widest">
                {certSettings.institutionName}
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-amber-950 dark:text-amber-100 tracking-tight">شهادة تفوّق وتكريم</h1>
              <div className="w-36 h-0.5 bg-linear-to-r from-transparent via-amber-600 to-transparent mx-auto mt-2" />
            </div>

            <div className="space-y-5 my-8 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              <p className="text-slate-600 dark:text-slate-400 text-xs md:text-sm">تشهد إدارة المقرر وأستاذه بأن الطالب / الطالبة:</p>

              <div className="py-2">
                <div className="text-2xl md:text-4xl font-black text-slate-950 border-b border-dashed border-amber-700/30 inline-block px-8 pb-1">
                  {certificate.studentName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  الرقم الأكاديمي: <bdi dir="ltr">{certificate.studentAcademicId}</bdi>
                </div>
              </div>

              <p className="max-w-xl mx-auto text-sm md:text-base text-slate-700 dark:text-slate-300">
                أتمّ بنجاح مقرر{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  "{certificate.courseTitle}" (<bdi dir="ltr">{certificate.courseCode}</bdi>)
                </strong>{' '}
                واستحق عن جدارة:
              </p>

              <div className="inline-block bg-amber-100/70 dark:bg-amber-500/15 border border-amber-300/80 dark:border-amber-500/40 rounded-2xl px-6 py-2.5">
                <div className="text-amber-900 dark:text-amber-200 font-black text-lg md:text-xl flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span>{certificate.rankTitle}</span>
                  <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-[12px] text-amber-800/80 dark:text-amber-300 mt-0.5">
                  بمجموع نقاط: <strong>{certificate.totalPoints}</strong>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-amber-900/20 grid grid-cols-3 items-end gap-2 text-xs">
              <div className="text-center space-y-1">
                <div className="h-14 flex items-end justify-center">
                  {certSettings.signatureDataUrl ? (
                    <img src={certSettings.signatureDataUrl} alt="توقيع الدكتور" className="max-h-14 max-w-full object-contain" />
                  ) : (
                    <div className="font-serif italic text-2xl text-slate-700 dark:text-slate-300">{certificate.doctorName}</div>
                  )}
                </div>
                <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 dark:text-slate-100 text-sm">{certificate.doctorName}</div>
                <div className="text-[12px] text-slate-500 dark:text-slate-400">أستاذ المقرر</div>
              </div>

              <div className="flex justify-center">
                <Seal code={certificate.courseCode} year={year} />
              </div>

              <div className="text-center space-y-1">
                <div className="text-[12px] text-slate-600 dark:text-slate-400 font-bold">تاريخ الإصدار</div>
                <div className="text-sm text-slate-800 dark:text-slate-200">{formatDate(certificate.issueDate)}</div>
                <div className="text-[12px] text-slate-500 dark:text-slate-400">
                  كود التحقق: <bdi dir="ltr">{certificate.certificateCode}</bdi>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div data-no-print className="bg-slate-50 dark:bg-slate-800/40 px-5 py-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-3">
          <span>يُنزَّل الملف بصيغة PDF أفقية A4. للطباعة اختر "حفظ كـ PDF" إن أردت نسخة نصية.</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
