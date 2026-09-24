import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, StudentLectureState } from '../types';
import {
  X,
  Eye,
  GraduationCap,
  Mail,
  Phone,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Award,
  BookOpen,
  FileText,
  KeyRound,
  Edit3,
  Save,
  MessageCircle,
  Star,
  Lock,
  Trophy
} from 'lucide-react';

interface StudentDetailsModalProps {
  student: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StudentDetailsModal: React.FC<StudentDetailsModalProps> = ({
  student,
  isOpen,
  onClose,
}) => {
  const {
    impersonateStudent,
    studentStates,
    courses,
    updateStudent,
    getLeaderboard,
    allowRetake
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'lectures' | 'edit'>('overview');
  const [editNotes, setEditNotes] = useState(student?.notes || '');
  const [editStatus, setEditStatus] = useState<User['status']>(student?.status || 'active');
  const [newPassword, setNewPassword] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen || !student) return null;

  // Filter student-specific records
  const studentLectureStates = studentStates.filter(s => s.studentId === student.id);
  const completedLecturesCount = studentLectureStates.filter(s => s.currentStage === 'completed').length;
  const attendedCount = studentLectureStates.filter(s => s.attended).length;
  const totalPoints = studentLectureStates.reduce((acc, curr) => acc + (curr.quizScore || 0), 0);

  const leaderboardEntries = getLeaderboard();
  const myEntry = leaderboardEntries.find(e => e.studentId === student.id);
  const currentCourse = courses[0];
  const allLectures = currentCourse?.weeks.flatMap(w => w.lectures) || [];

  const handleImpersonate = () => {
    impersonateStudent(student.id);
    onClose();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Partial<User> = {
      notes: editNotes,
      status: editStatus,
    };
    if (newPassword.trim()) {
      updates.password = newPassword.trim();
    }
    updateStudent(student.id, updates);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div
      id="student-details-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="student-details-modal-content"
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8"
      >
        {/* Header with Student Identity Banner */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {student.avatar ? (
                <img
                  src={student.avatar}
                  alt={student.name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-400/40 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold">
                  {student.name.slice(0, 1)}
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">{student.name}</h2>
                  <span className={`text-[12px] font-bold px-2 py-0.5 rounded-md ${
                    student.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {student.status === 'active' ? 'نشط ومسجل' : 'موقوف'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1.5 font-mono">
                  <span className="bg-white/10 px-2 py-0.5 rounded-md font-bold text-indigo-200">
                    كود الطالب: {student.academicId}
                  </span>
                  <span>@{student.username}</span>
                  <span>•</span>
                  <span>{[student.faculty, student.department].filter(Boolean).join(' — ')}</span>
                </div>
              </div>
            </div>

            {/* Impersonate Button */}
            <button
              id="btn-impersonate-from-modal"
              onClick={handleImpersonate}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              دخول كـ طالب (معاينة نشاطه)
            </button>
          </div>

          {/* Nav Tabs */}
          <div className="flex items-center gap-2 mt-6 border-t border-white/10 pt-3">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              نظرة عامة والترتيب
            </button>
            <button
              onClick={() => setActiveTab('lectures')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'lectures'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              سجل المراحل والمحاضرات ({allLectures.length})
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              إدارة الحساب والملاحظات
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">المركز التنافسي</span>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                    #{myEntry?.rank || '-'}
                  </div>
                  <div className="text-[12px] text-amber-800 dark:text-amber-300 font-bold mt-0.5">
                    {myEntry?.badge === 'gold' ? '🥇 درع ذهبي' : myEntry?.badge === 'silver' ? '🥈 درع فضي' : myEntry?.badge === 'bronze' ? '🥉 درع برونزي' : 'مشارك'}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">مجموع النقاط</span>
                  <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {totalPoints} نقطة
                  </div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">من كافة الكويزات</div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">المحاضرات المكتملة</span>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                    {completedLecturesCount} / {allLectures.length}
                  </div>
                  <div className="text-[12px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                    {Math.round((completedLecturesCount / (allLectures.length || 1)) * 100)}% إنجاز
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">مرات تسجيل الحضور</span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {attendedCount} محاضرات
                  </div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">المرحلة 2</div>
                </div>
              </div>

              {/* Student Personal Info List */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  البيانات الأكاديمية والاتصال
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>البريد:</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">{student.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>الهاتف:</span>
                    <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">{student.phone || 'غير مسجل'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>القسم:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-bold">{[student.faculty, student.department].filter(Boolean).join(' — ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>تاريخ التسجيل:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-bold">{student.joinedDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>آخر ظهور بالمنصة:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-bold">{student.lastLogin || 'حديثاً'}</span>
                  </div>
                </div>
              </div>

              {/* Doctor's Notes */}
              {student.notes && (
                <div className="bg-indigo-50/60 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/25 p-4">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block mb-1">
                    ملاحظات وتوجيهات أستاذ المقرر:
                  </span>
                  <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                    {student.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'lectures' && (
            <div className="space-y-3">
              {allLectures.map(lec => {
                const state = studentLectureStates.find(s => s.lectureId === lec.id);
                const isCompleted = state?.currentStage === 'completed';

                return (
                  <div
                    key={lec.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">{lec.title}</h5>
                        <span className="text-[12px] text-slate-500 dark:text-slate-400 font-mono">
                          المدة: {lec.duration}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <span className="text-xs bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-lg">
                            مكتملة بالكامل ({state?.quizScore} نقطة)
                          </span>
                        ) : state?.stage2Completed ? (
                          <span className="text-xs bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 font-bold px-2.5 py-1 rounded-lg">
                            تم الحضور (المرحلة 2)
                          </span>
                        ) : state?.stage1Completed ? (
                          <span className="text-xs bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold px-2.5 py-1 rounded-lg">
                            قراءة الشرح (المرحلة 1)
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold px-2.5 py-1 rounded-lg">
                            لم تبدأ بعد
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stage breakdown */}
                    <div className="grid grid-cols-3 gap-2 text-[12px] pt-1 border-t border-slate-200/60 dark:border-slate-700">
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <span>قراءة الـ PDF:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {state?.stage1Completed ? '✓ تم' : 'لم يقرأ'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <span>التقييم:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center">
                          {state?.starRating ? (
                            <>
                              {state.starRating} <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline mr-0.5" />
                            </>
                          ) : '-'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <span>درجة الكويز:</span>
                        <span className="font-bold text-indigo-700 dark:text-indigo-300">
                          {state?.quizScore !== undefined ? `${state.quizScore} نقطة` : 'لم يحل'}
                        </span>
                      </div>
                    </div>

                    {state?.feedbackComment && (
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[12px] text-slate-600 dark:text-slate-400">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">تعليق الطالب على المحاضرة:</span>
                        {state.feedbackComment}
                      </div>
                    )}

                    {isCompleted && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] pt-2 border-t border-slate-200/60 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400">
                          محاولات: {state?.quizAttemptsCount || 1}
                          {!!state?.tabSwitches && <> · غادر التبويب {state.tabSwitches} مرات</>}
                          {state?.quizDurationSeconds !== undefined && <> · المدة {Math.round(state.quizDurationSeconds / 60)} د</>}
                        </span>
                        <button
                          onClick={() => window.confirm('السماح للطالب بإعادة الكويز؟ ستُمسح نتيجته الحالية.') && allowRetake(student!.id, lec.id)}
                          className="font-bold text-indigo-700 dark:text-indigo-300 hover:underline"
                        >
                          السماح بإعادة الكويز
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'edit' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  تم حفظ التعديلات بنجاح!
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  حالة حساب الطالب
                </label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as User['status'])}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs cursor-pointer"
                >
                  <option value="active">نشط ومصرّح له بدخول المنصة</option>
                  <option value="suspended">موقوف مؤقتاً (لا يمكنه الدخول)</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  إعادة تعيين كلمة المرور للطالب
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="اترك فارغاً للاحتفاظ بكلمة المرور الحالية"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left"
                  dir="ltr"
                />
                <span className="text-[12px] text-slate-500 dark:text-slate-400">
                  كلمة المرور الحالية: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-800 dark:text-slate-200">{student.password}</code>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تعديل ملاحظات المشرف على الطالب
                </label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                حفظ التغييرات على ملف الطالب
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
