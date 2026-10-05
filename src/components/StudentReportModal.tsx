import React, { useRef } from 'react';
import { User } from '../types';
import { useApp } from '../context/AppContext';
import { Printer, X, Award, CheckCircle2, AlertTriangle, GraduationCap, Calendar, Phone, Mail, Building2, UserCheck, Sparkles } from 'lucide-react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

interface Props {
  student: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StudentReportModal: React.FC<Props> = ({ student, isOpen, onClose }) => {
  useEscapeToClose(isOpen, onClose);
  const { studentStates, courses, getLeaderboard, currentUser } = useApp();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !student) return null;

  // Compute student stats
  const states = studentStates.filter(s => s.studentId === student.id);
  const allLectures = courses.flatMap(c => c.weeks.flatMap(w => w.lectures));
  const attendedCount = states.filter(s => s.attended).length;
  const completedQuizCount = states.filter(s => s.quizCompleted && s.quizScore !== undefined).length;
  const totalScore = states.reduce((acc, curr) => acc + (curr.quizScore || 0), 0);

  const leaderboard = getLeaderboard();
  const rankIdx = leaderboard.findIndex(e => e.studentId === student.id);
  const rank = rankIdx >= 0 ? rankIdx + 1 : '-';

  const attendanceRate = allLectures.length ? Math.round((attendedCount / allLectures.length) * 100) : 0;
  
  // Status level classification
  const levelClass =
    attendanceRate >= 85 && totalScore >= 70
      ? { label: 'طالب ممتاز (متفوق ومنتظم)', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' }
      : attendanceRate >= 70
      ? { label: 'طالب جيد (مستوى مستقر)', color: 'text-indigo-700 bg-indigo-50 border-indigo-300' }
      : { label: 'طالب تحت المتابعة (يحتاج التزام)', color: 'text-amber-700 bg-amber-50 border-amber-300' };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4 print:shadow-none print:border-none print:m-0 print:w-full print:max-w-none">
        {/* Modal Controls Header - Hidden on Print */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold">معاينة بيان حالة الطالب والأداء الأكاديمي</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              طباعة / حفظ PDF
            </button>
            <button onClick={onClose} aria-label="إغلاق" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div ref={printRef} className="p-6 sm:p-10 space-y-6 text-slate-900 bg-white dark:bg-slate-900 dark:text-slate-100 print:text-black print:bg-white print:p-6 print:space-y-4">
          
          {/* Header Seal Banner */}
          <div className="border-b-2 border-indigo-600 pb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xl font-black tracking-tight text-indigo-900 dark:text-indigo-400 print:text-black">
                المنصة الأكاديمية التعليمية - بيان أداء ومستوى طالب
              </div>
              <div className="text-xs font-bold text-slate-500 print:text-slate-700">
                الأستاذ الدكتور / {currentUser?.name || 'مقرر المادة'}
              </div>
            </div>
            <div className="text-end text-xs space-y-1">
              <div className="font-bold text-slate-700 dark:text-slate-300 print:text-black">تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</div>
              <div className="text-slate-500 dark:text-slate-400 print:text-slate-600">رقم القيد / الكود: #{student.academicId || student.id.slice(0, 8)}</div>
            </div>
          </div>

          {/* Student Profile Overview Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 print:bg-slate-50 print:border-slate-300">
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black">{student.name}</span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${levelClass.color}`}>
                  {levelClass.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 print:text-slate-800">
                <div className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-400" /> الكلية: {student.faculty || 'عام'}</div>
                <div className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5 text-slate-400" /> القسم: {student.department || 'غير محدد'}</div>
                <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> الهاتف: {student.phone || 'غير مسجل'}</div>
                <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> البريد: {student.email || 'غير مسجل'}</div>
              </div>
            </div>
            <div className="flex flex-col justify-center items-end border-s border-slate-200 dark:border-slate-700 ps-4 text-xs space-y-1.5 print:border-slate-300">
              <div className="font-bold text-slate-500">الترتيب في الدفعة:</div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 print:text-indigo-900">المركز #{rank}</div>
              <div className="text-[11px] text-slate-500">من إجمالي {leaderboard.length} طالب</div>
            </div>
          </div>

          {/* Stat KPI Boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl print:border-slate-300 print:bg-white">
              <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 print:text-black">{attendanceRate}%</div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 print:text-slate-700">نسبة الانتظام والحضور</div>
            </div>
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl print:border-slate-300 print:bg-white">
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 print:text-black">{totalScore}</div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 print:text-slate-700">مجموع درجات الكويزات</div>
            </div>
            <div className="p-3 bg-purple-50/60 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl print:border-slate-300 print:bg-white">
              <div className="text-2xl font-black text-purple-700 dark:text-purple-300 print:text-black">{attendedCount} / {allLectures.length}</div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 print:text-slate-700">المحاضرات المحضورة</div>
            </div>
            <div className="p-3 bg-blue-50/60 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl print:border-slate-300 print:bg-white">
              <div className="text-2xl font-black text-blue-700 dark:text-blue-300 print:text-black">{completedQuizCount}</div>
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 print:text-slate-700">الكويزات المكتملة</div>
            </div>
          </div>

          {/* Detailed Lectures & Quizzes Table */}
          <div className="space-y-2">
            <h4 className="text-sm font-extrabold flex items-center gap-1.5 text-slate-900 dark:text-slate-100 print:text-black">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              سجل تفصيلي بالحضور والكويزات لكل محاضرة:
            </h4>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl print:border-slate-300">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 print:bg-slate-200 print:text-black">
                  <tr>
                    <th className="p-2.5 text-start">المحاضرة / الكويز</th>
                    <th className="p-2.5 text-center">مشاهدة الشرح</th>
                    <th className="p-2.5 text-center">حضور السيشن</th>
                    <th className="p-2.5 text-center">درجة الكويز</th>
                    <th className="p-2.5 text-center">تقييم الطالب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-300">
                  {allLectures.map(lec => {
                    const st = states.find(s => s.lectureId === lec.id);
                    const watched = Boolean(st?.stage1Completed || st?.currentStage === 'completed');
                    const attended = st?.attended;
                    const score = st?.quizScore !== undefined ? `${st.quizScore} / ${st.quizTotalPoints || 10}` : 'لم يحل';
                    const rating = st?.starRating ? `⭐ ${st.starRating}/5` : '-';

                    return (
                      <tr key={lec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 print:hover:bg-transparent">
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 print:text-black">{lec.title}</td>
                        <td className="p-2.5 text-center">
                          {watched ? <span className="text-emerald-600 font-bold">✓ مكتمل</span> : <span className="text-slate-400">غير مكتمل</span>}
                        </td>
                        <td className="p-2.5 text-center">
                          {attended ? <span className="text-emerald-600 font-bold">✓ حاضر</span> : <span className="text-rose-500 font-bold">غائب</span>}
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-900 dark:text-slate-100 print:text-black">{score}</td>
                        <td className="p-2.5 text-center text-slate-600 dark:text-slate-400 print:text-slate-700">{rating}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes & Doctor Sign Block */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4 text-xs print:pt-6">
            <div className="space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 print:text-black">ملاحظات الأستاذ الدكتور:</span>
              <p className="text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 print:bg-white print:border-slate-300 print:text-black">
                {student.notes || 'الطالب ملتزم بالواجبات والكويزات الموكلة إليه وفق الخطة الدراسية المعتمدة.'}
              </p>
            </div>
            <div className="flex flex-col items-center justify-end space-y-1 text-center">
              <div className="font-bold text-slate-800 dark:text-slate-200 print:text-black">توقيع أستاذ المادة وتصديق المنصة</div>
              <div className="w-32 h-12 border-b-2 border-dashed border-slate-300 dark:border-slate-600 my-1 flex items-center justify-center text-[10px] text-slate-400">
                [ختم وتوقيع المنصة]
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
