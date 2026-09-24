import React from 'react';
import { useApp } from '../context/AppContext';
import { BrandMark } from './Header';
import { DEMO_ACCOUNTS } from '../demoAccounts';
import {
  ArrowLeft,
  BellRing,
  BookOpenCheck,
  Eye,
  FileText,
  GraduationCap,
  ListChecks,
  MessageCircle,
  ShieldCheck,
  Trophy,
  UserCheck,
  Award
} from 'lucide-react';

interface LandingPageProps {
  onOpenAuth: (mode?: 'login' | 'signup') => void;
}


const STEPS = [
  { n: 1, title: 'شرح المحاضرة', text: 'قراءة ملف الـ PDF والسلايدات بتتبّع للتقدم.', icon: FileText },
  { n: 2, title: 'الحضور والتقييم', text: 'تأكيد الحضور وتقييم المحاضرة لبدء مؤقت الكويز.', icon: UserCheck },
  { n: 3, title: 'حل الكويز', text: 'أسئلة مولّدة من بنك الأسئلة، ونقاط تدخل الترتيب.', icon: ListChecks }
];

const FEATURES = [
  { title: 'إنذار مبكر', text: 'تنبيه تلقائي عند الغياب المتتالي أو هبوط الأداء.', icon: BellRing },
  { title: 'لوحة الشرف', text: 'ترتيب تنافسي ودروع ذهبية وفضية وبرونزية.', icon: Trophy },
  { title: 'شهادات تكريم', text: 'إصدار واعتماد وطباعة شهادات للمتفوقين.', icon: Award },
  { title: 'معاينة كطالب', text: 'ادخل بحساب أي طالب لترى ما يراه بالضبط.', icon: Eye },
  { title: 'رسائل واتساب', text: 'صياغة جاهزة للتواصل مع الطالب بضغطة واحدة.', icon: MessageCircle },
  { title: 'بنوك أسئلة', text: 'رفع أسئلة PDF وتحويلها إلى كويز تلقائياً.', icon: BookOpenCheck }
];

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const { quickLogin } = useApp();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-14 sm:space-y-20">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-indigo-800 via-indigo-900 to-indigo-950 text-white px-6 sm:px-12 py-12 sm:py-16 shadow-lift animate-rise">
        <div className="absolute inset-0 hero-pattern opacity-70" aria-hidden="true" />
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-400/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 bg-white/10 border border-white/15 px-3 py-1.5 rounded-full text-xs font-bold text-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              منصة إدارة التعلم للمقررات الجامعية
            </span>
            <h2 className="text-3xl sm:text-5xl font-black leading-[1.25]">
              محاضرة، حضور، كويز.
              <br />
              <span className="text-amber-300">وأنت ترى كل شيء.</span>
            </h2>
            <p className="text-sm sm:text-base text-indigo-100/90 max-w-xl leading-relaxed">
              يتابع الدكتور كل طالب لحظة بلحظة، وينبَّه مبكراً لمن يتراجع، ويكرّم المتفوقين.
              ويعرف الطالب دائماً أين وصل وما الخطوة التالية.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => onOpenAuth('login')}
                className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 px-6 py-3 rounded-xl text-sm font-black shadow-lg shadow-black/20 transition-colors"
              >
                تسجيل الدخول
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors"
              >
                إنشاء حساب جديد
              </button>
            </div>
          </div>

          {/* Flow preview card */}
          <div className="hidden lg:block">
            <div className="bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <BrandMark className="w-11 h-11" />
                <div>
                  <div className="text-sm font-extrabold">مسار المحاضرة</div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400">ثلاث مراحل متتابعة، لا تُفتح التالية قبل السابقة</div>
                </div>
              </div>
              <ol className="space-y-2.5">
                {STEPS.map(s => (
                  <li
                    key={s.n}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                  >
                    <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-black shrink-0">
                      {s.n}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{s.title}</div>
                      <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{s.text}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Demo accounts */}
      <section aria-labelledby="demo-title" className="space-y-6">
        <div className="max-w-2xl">
          <h3 id="demo-title" className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            جرّب المنصة الآن بحساب تجريبي
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5">
            اختر دوراً وادخل بضغطة واحدة، بدون تسجيل. البيانات محفوظة على جهازك فقط.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEMO_ACCOUNTS.map((a, i) => (
            <button
              key={a.username}
              onClick={() => quickLogin(a.username)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="group surface p-5 text-start hover:-translate-y-0.5 hover:shadow-lift hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all animate-rise flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${a.tone}`}>
                  <a.icon className="w-5 h-5" />
                </span>
                <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {a.role}
                </span>
              </div>
              <div className="space-y-1 flex-1">
                <div className="text-base font-extrabold text-slate-900 dark:text-slate-100">{a.name}</div>
                <div className="text-[12px] text-slate-400 font-mono">
                  <bdi dir="ltr">{a.code}</bdi>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">{a.blurb}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 group-hover:gap-2.5 transition-all">
                دخول سريع
                <ArrowLeft className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-title" className="space-y-6">
        <div className="max-w-2xl">
          <h3 id="features-title" className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            كل ما يحتاجه المقرر في مكان واحد
          </h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="surface p-5 flex items-start gap-4">
              <span className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5" />
              </span>
              <div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{f.title}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
