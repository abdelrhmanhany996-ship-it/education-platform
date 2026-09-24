import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { departmentText, EMPTY_FACULTY, FacultyPicker, FacultyValue, facultyError } from './FacultyPicker';
import {
  X,
  UserPlus,
  GraduationCap,
  ShieldCheck,
  Headset,
  Hash,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: UserRole;
}

const input =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const label = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, initialRole = 'student' }) => {
  const { addUserByDoctor, users, currentUser } = useApp();

  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [academicId, setAcademicId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [faculty, setFaculty] = useState<FacultyValue>(EMPTY_FACULTY);
  const [password, setPassword] = useState('123456');
  const [notes, setNotes] = useState('');
  const [subjectsText, setSubjectsText] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const generateAutoId = (targetRole: UserRole) => {
    const year = new Date().getFullYear();
    const count = users.filter(u => u.role === targetRole).length + 1;
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const newId = targetRole === 'doctor' ? `DOC-${randomSuffix}` : targetRole === 'assistant' ? `AST-${randomSuffix}` : `STD-${year}-${randomSuffix}`;
    setAcademicId(newId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) return setErrorMsg('يرجى إدخال اسم الحساب بالكامل');
    if (!username.trim()) return setErrorMsg('يرجى إدخال اسم مستخدم فريد');
    if (!email.trim()) return setErrorMsg('البريد الإلكتروني مطلوب');
    if (!phone.trim()) return setErrorMsg('رقم الهاتف مطلوب');
    if (role !== 'assistant' && facultyError(faculty)) return setErrorMsg(facultyError(faculty));

    const subjects = subjectsText
      .split(/[,،\n]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (role === 'doctor' && !subjects.length) return setErrorMsg('أدخل مادة واحدة على الأقل يدرّسها الدكتور');

    setBusy(true);
    const res = await addUserByDoctor({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      academicId: academicId.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      role,
      faculty: role === 'assistant' ? currentUser?.faculty : faculty.faculty.trim(),
      department: role === 'assistant' ? currentUser?.department || '' : departmentText(faculty),
      password: password || '123456',
      notes: notes.trim() || undefined,
      subjects: role === 'doctor' ? subjects : undefined
    });
    setBusy(false);

    if (res.success && res.user) {
      const roleLabel = role === 'doctor' ? 'الدكتور' : role === 'assistant' ? 'المساعد' : 'الطالب';
      setSuccessMsg(`تم بنجاح إنشاء حساب ${roleLabel} (${res.user.name}) بالمعرف: ${res.user.academicId}`);
      setTimeout(onClose, 1400);
    } else {
      setErrorMsg(res.error || 'حدث خطأ أثناء إضافة المستخدم');
    }
  };

  const roles: { id: UserRole; title: string; hint: string; icon: typeof GraduationCap; tone: string }[] = [
    { id: 'student', title: 'طالب', hint: 'رقم أكاديمي وسجل متابعة', icon: GraduationCap, tone: 'indigo' },
    { id: 'doctor', title: 'دكتور', hint: 'مقررات وصلاحيات كاملة', icon: ShieldCheck, tone: 'purple' },
    { id: 'assistant', title: 'مساعد', hint: 'رسائل ودفع وملفات، بلا تعديل محتوى', icon: Headset, tone: 'amber' }
  ];

  return (
    <div
      id="add-user-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="add-user-modal-content"
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8"
      >
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-600 rounded-xl">
              <UserPlus className="w-5 h-5 text-white" />
            </span>
            <div>
              <h3 className="text-base font-bold">إضافة حساب جديد للنظام</h3>
              <p className="text-xs text-slate-400">طالب، دكتور، أو مساعد بمعرف فريد</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className={label}>نوع الحساب المراد إضافته:</label>
            <div className="grid grid-cols-3 gap-2">
              {roles.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRole(r.id);
                    generateAutoId(r.id);
                  }}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                    role === r.id
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-500/10 text-indigo-950 dark:text-indigo-100 font-bold ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <r.icon className="w-4 h-4" />
                  <div className="text-xs font-bold">{r.title}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{r.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={label}>الاسم الكامل *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="مثال: كريم سامي عبد العزيز" className={input} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>اسم المستخدم (Username) *</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/\s+/g, '_'))}
                  placeholder="karim_samy"
                  className={`${input} pl-3 pr-7 font-mono text-left`}
                  dir="ltr"
                  required
                />
                <User className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الكود ({role === 'doctor' ? 'دكتور' : role === 'assistant' ? 'مساعد' : 'طالب'})</label>
                <button type="button" onClick={() => generateAutoId(role)} className="text-[12px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer">
                  توليد
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={academicId}
                  onChange={e => setAcademicId(e.target.value)}
                  className={`${input} pl-3 pr-7 font-mono font-bold text-indigo-700 dark:text-indigo-300 text-left`}
                  dir="ltr"
                />
                <Hash className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {role === 'doctor' && (
            <div>
              <label className={label}>المواد التي يدرّسها * (افصل بفاصلة، كل مادة تصبح مقرراً مستقلاً)</label>
              <textarea
                value={subjectsText}
                onChange={e => setSubjectsText(e.target.value)}
                placeholder="مثال: هياكل البيانات، قواعد البيانات، شبكات الحاسب"
                rows={2}
                className={input}
                required
              />
            </div>
          )}

          {role === 'assistant' ? (
            <div>
              <label className={label}>الدكتور الذي يعمل معه</label>
              <div className={`${input} bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold`}>
                {currentUser?.name || '—'}
              </div>
            </div>
          ) : (
            <FacultyPicker value={faculty} onChange={setFaculty} selectClassName={input} labelClassName={label} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>كلمة المرور الابتدائية</label>
              <div className="relative">
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="123456"
                  className={`${input} pl-3 pr-7 font-mono text-left`}
                  dir="ltr"
                />
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>البريد الإلكتروني {role === 'student' ? '(للتواصل)' : ''}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@academy.edu" className={`${input} text-left`} dir="ltr" required />
            </div>
            <div>
              <label className={label}>رقم الهاتف {role === 'student' ? '(واتساب)' : ''}</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="010XXXXXXXX" className={`${input} text-left`} dir="ltr" required />
            </div>
          </div>

          <div>
            <label className={label}>ملاحظات</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={input} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer">
              حفظ وإضافة الحساب للنظام
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
