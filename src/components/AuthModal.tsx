import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { CatalogCourse } from '../api';
import { departmentText, EMPTY_FACULTY, FacultyPicker, FacultyValue, facultyError } from './FacultyPicker';
import {
  X,
  GraduationCap,
  User,
  KeyRound,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  BookOpen,
  Clock
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

const input =
  'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const label = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, signup, quickLogin, getCatalog } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign up form state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [faculty, setFaculty] = useState<FacultyValue>(EMPTY_FACULTY);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  // Catalog
  const [catalog, setCatalog] = useState<CatalogCourse[] | null>(null);
  const [catalogError, setCatalogError] = useState('');

  // Status feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingMsg, setPendingMsg] = useState('');
  const [telegramLink, setTelegramLink] = useState('');

  // Re-sync the tab each time the modal is opened (it stays mounted while closed), and close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setSignupStep(1);
    setErrorMsg('');
    setPendingMsg('');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen || mode !== 'signup') return;
    setCatalogError('');
    getCatalog()
      .then(setCatalog)
      .catch(() => setCatalogError('تعذّر تحميل قائمة المواد. تأكد من اتصالك ثم أعد المحاولة.'));
  }, [isOpen, mode]);

  const bySubject = useMemo(() => {
    const groups = new Map<string, CatalogCourse[]>();
    for (const c of catalog || []) {
      const list = groups.get(c.title) || [];
      list.push(c);
      groups.set(c.title, list);
    }
    return [...groups.entries()];
  }, [catalog]);

  if (!isOpen) return null;

  // Within one subject there can be several doctors, but a student picks exactly one of them;
  // across different subjects the student can pick as many as they want.
  const toggleCourse = (id: string) => {
    const subjectOptions = bySubject.find(([, options]) => options.some(o => o.courseId === id))?.[1] || [];
    const siblingIds = new Set(subjectOptions.map(o => o.courseId));
    setSelectedCourseIds(prev => {
      const withoutSiblings = prev.filter(x => !siblingIds.has(x));
      return prev.includes(id) ? withoutSiblings : [...withoutSiblings, id];
    });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!loginUsername.trim()) return setErrorMsg('يرجى إدخال اسم المستخدم أو الرقم الأكاديمي');
    if (!loginPassword) return setErrorMsg('يرجى إدخال كلمة المرور');

    setBusy(true);
    const res = await login(loginUsername, loginPassword);
    setBusy(false);
    if (res.success) onClose();
    else setErrorMsg(res.error || 'فشل تسجيل الدخول');
  };

  const goToStep2 = () => {
    setErrorMsg('');
    if (!name.trim()) return setErrorMsg('يرجى إدخال الاسم الكامل');
    if (username.trim().length < 3) return setErrorMsg('اسم المستخدم يجب ألا يقل عن 3 أحرف');
    if (phone.replace(/\D/g, '').length < 8) return setErrorMsg('رقم الهاتف مطلوب وسيُستخدم للتواصل والواتساب');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErrorMsg('البريد الإلكتروني مطلوب وبصيغة صحيحة');
    if (password.length < 5) return setErrorMsg('كلمة المرور يجب ألا تقل عن 5 أحرف');
    if (password !== confirmPassword) return setErrorMsg('كلمتا المرور غير متطابقتين');
    if (facultyError(faculty)) return setErrorMsg(facultyError(faculty));
    setSignupStep(2);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedCourseIds.length) return setErrorMsg('اختر مادة واحدة على الأقل');

    setBusy(true);
    const res = await signup({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim(),
      phone: phone.trim(),
      faculty: faculty.faculty.trim(),
      department: departmentText(faculty),
      password,
      courseIds: selectedCourseIds
    });
    setBusy(false);

    if (res.success) {
      setPendingMsg(res.message || 'تم إرسال طلبك بنجاح.');
      setTelegramLink(res.telegramLink || '');
    }
    else setErrorMsg(res.error || 'فشل إرسال الطلب');
  };

  const resetAndClose = () => {
    setName('');
    setUsername('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setSelectedCourseIds([]);
    setFaculty(EMPTY_FACULTY);
    setSignupStep(1);
    setPendingMsg('');
    setTelegramLink('');
    onClose();
  };

  return (
    <div
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="auth-modal-container"
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8"
      >
        {/* Header */}
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
          <button
            id="close-auth-modal"
            onClick={resetAndClose}
            className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 bg-indigo-600/40 rounded-xl">
              <GraduationCap className="w-6 h-6 text-indigo-400" />
            </span>
            <span className="text-xs font-bold text-indigo-300">المنظومة الأكاديمية الذكية</span>
          </div>

          <h2 className="text-xl font-black text-white">
            {pendingMsg ? 'تم إرسال طلبك' : mode === 'login' ? 'تسجيل الدخول إلى المنصة' : `إنشاء حساب طالب — الخطوة ${signupStep} من 2`}
          </h2>
          {!pendingMsg && (
            <p className="text-xs text-slate-300 mt-1">
              {mode === 'login'
                ? 'أدخل اسم المستخدم وكلمة المرور الخاصة بك للمتابعة'
                : signupStep === 1
                ? 'بياناتك الأساسية، ثم تختار المواد في الخطوة التالية'
                : 'اختر مادة واحدة أو أكثر، ثم الدكتور الذي تريده لكل مادة'}
            </p>
          )}

          {!pendingMsg && (
            <div className="flex bg-white/10 p-1 rounded-xl mt-5">
              <button
                id="tab-login"
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'login' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                id="tab-signup"
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'signup' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                إنشاء حساب جديد
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {pendingMsg ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <Clock className="w-8 h-8" />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">{pendingMsg}</p>
              {telegramLink && (
                <a
                  href={telegramLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold"
                >
                  اربط تليجرام الآن ليتواصل معك الدكتور
                </a>
              )}
              <button
                onClick={resetAndClose}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold"
              >
                حسناً
              </button>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className={label}>اسم المستخدم أو الرقم الأكاديمي</label>
                    <div className="relative">
                      <input
                        id="input-login-username"
                        type="text"
                        value={loginUsername}
                        onChange={e => setLoginUsername(e.target.value)}
                        placeholder="مثال: doctor أو ahmed_ali أو STD-2024-001"
                        className={`${input} pl-3 pr-10 text-left`}
                        dir="ltr"
                      />
                      <User className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                    </div>
                  </div>

                  <div>
                    <label className={label}>كلمة المرور</label>
                    <div className="relative">
                      <input
                        id="input-login-password"
                        type="password"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${input} pl-3 pr-10 text-left`}
                        dir="ltr"
                      />
                      <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                    </div>
                  </div>

                  <button
                    id="btn-submit-login"
                    type="submit"
                    disabled={busy}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer mt-2 flex items-center justify-center gap-2"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    تسجيل الدخول للمنظومة
                  </button>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400 block mb-2">
                      دخول سريع للتجربة والمراجعة الفورية:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          quickLogin('doctor');
                          onClose();
                        }}
                        className="p-2 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/15 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-500/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        دخول كـ دكتور (المشرف)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          quickLogin('ahmed_ali');
                          onClose();
                        }}
                        className="p-2 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/15 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-500/25 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        دخول كـ طالب (أحمد علي)
                      </button>
                    </div>
                  </div>
                </form>
              ) : signupStep === 1 ? (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    goToStep2();
                  }}
                  className="space-y-3.5"
                >
                  <div>
                    <label className={label}>الاسم الكامل *</label>
                    <input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="مثال: محمد مصطفى السعيد"
                      className={input}
                      required
                    />
                  </div>

                  <div>
                    <label className={label}>اسم المستخدم الفريد *</label>
                    <div className="relative">
                      <input
                        id="signup-username"
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value.replace(/\s+/g, '_'))}
                        placeholder="mohamed_2026"
                        className={`${input} pl-3 pr-8 font-mono text-left`}
                        dir="ltr"
                        required
                      />
                      <User className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={label}>رقم الهاتف (واتساب) *</label>
                      <div className="relative">
                        <input
                          id="signup-phone"
                          type="tel"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="01012345678"
                          className={`${input} pl-3 pr-8 text-left`}
                          dir="ltr"
                          required
                        />
                        <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
                      </div>
                    </div>
                    <div>
                      <label className={label}>البريد الإلكتروني *</label>
                      <div className="relative">
                        <input
                          id="signup-email"
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="student@mail.com"
                          className={`${input} pl-3 pr-8 text-left`}
                          dir="ltr"
                          required
                        />
                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
                      </div>
                    </div>
                  </div>

                  <FacultyPicker value={faculty} onChange={setFaculty} selectClassName={input} labelClassName={label} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={label}>كلمة المرور *</label>
                      <input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${input} text-left`}
                        dir="ltr"
                        required
                      />
                    </div>
                    <div>
                      <label className={label}>تأكيد كلمة المرور *</label>
                      <input
                        id="signup-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className={`${input} text-left`}
                        dir="ltr"
                        required
                      />
                    </div>
                  </div>

                  <button
                    id="btn-signup-next"
                    type="submit"
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer mt-2 flex items-center justify-center gap-2"
                  >
                    التالي: اختيار المواد
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setSignupStep(1)}
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    رجوع لتعديل بياناتي
                  </button>

                  {catalogError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs">
                      {catalogError}
                    </div>
                  )}

                  {!catalog ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  ) : bySubject.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">لا توجد مواد متاحة للتسجيل حالياً.</p>
                  ) : (
                    <div className="space-y-4 max-h-80 overflow-y-auto scroll-thin pe-1">
                      {bySubject.map(([subject, options]) => (
                        <div key={subject} className="space-y-1.5">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            {subject}
                          </div>
                          <div className="grid gap-2">
                            {options.map(c => {
                              const checked = selectedCourseIds.includes(c.courseId);
                              return (
                                <label
                                  key={c.courseId}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                                    checked
                                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                  }`}
                                >
                                  <input type="radio" name={`subject-${subject}`} checked={checked} onChange={() => toggleCourse(c.courseId)} />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{c.doctorName}</div>
                                    <div className="text-[12px] text-slate-500 dark:text-slate-400">
                                      <bdi dir="ltr">{c.code}</bdi> · {c.department}
                                    </div>
                                  </div>
                                  {typeof c.price === 'number' && (
                                    <span className="text-[12px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg shrink-0">
                                      {c.price} ج.م
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[12px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3">
                    بعد الإرسال سيتواصل معك الدكتور أو مساعده لإتمام الدفع. حسابك يُفعَّل بعد موافقته، وستقدر تسجّل الدخول حينها.
                  </p>

                  <button
                    id="btn-submit-signup"
                    type="submit"
                    disabled={busy || !selectedCourseIds.length}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    <CheckCircle2 className="w-4 h-4" />
                    إرسال طلب التسجيل
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
