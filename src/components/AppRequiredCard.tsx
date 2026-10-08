import React from 'react';
import { Apple, Download, Monitor, ShieldCheck, Smartphone } from 'lucide-react';

/** Fixed download links of the "apps" release (built by .github/workflows/apps.yml). */
const RELEASE = 'https://github.com/abdelrhmanhany996-ship-it/education-platform/releases/download/apps';
export const APP_DOWNLOADS = {
  android: `${RELEASE}/AcademicPlatform.apk`,
  windows: `${RELEASE}/AcademicPlatform-Setup.exe`,
  mac: `${RELEASE}/AcademicPlatform.dmg`
};

/** True inside the protected Android / desktop app (their WebView adds this marker). */
export const inProtectedApp = () => typeof navigator !== 'undefined' && /AcademicPlatformApp\//.test(navigator.userAgent);

const platform = (): 'android' | 'ios' | 'windows' | 'mac' | 'other' => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS/i.test(ua)) return 'mac';
  return 'other';
};

const OPTIONS = [
  { key: 'android', label: 'Android', hint: 'ملف APK', icon: Smartphone, href: APP_DOWNLOADS.android },
  { key: 'windows', label: 'Windows', hint: 'برنامج تثبيت', icon: Monitor, href: APP_DOWNLOADS.windows },
  { key: 'mac', label: 'macOS', hint: 'ملف DMG', icon: Apple, href: APP_DOWNLOADS.mac }
] as const;

/** Shown to students in a browser when the doctor requires the protected apps for lectures. */
export const AppRequiredCard: React.FC = () => {
  const mine = platform();
  const sorted = [...OPTIONS].sort((a, b) => Number(b.key === mine) - Number(a.key === mine));
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-slate-900 p-6 sm:p-8 text-center space-y-5 shadow-sm">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center">
        <ShieldCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-300" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">المحاضرة متاحة من تطبيق المنصة فقط</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          لحماية المحتوى، يُعرض الفيديو وملف الشرح داخل تطبيق المنصة، حيث يظهر تصوير الشاشة والتسجيل باللون الأسود. حمّل التطبيق وسجّل الدخول بنفس حسابك.
        </p>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {sorted.map(o => (
          <a
            key={o.key}
            href={o.href}
            className={`flex flex-col items-center gap-1 rounded-xl border p-4 transition ${
              o.key === mine
                ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
                : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <o.icon className="w-6 h-6" />
            <span className="text-sm font-extrabold">{o.label}</span>
            <span className={`text-[11px] flex items-center gap-1 ${o.key === mine ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
              <Download className="w-3 h-3" />
              {o.hint}
            </span>
          </a>
        ))}
      </div>
      {mine === 'android' && (
        <p className="text-[12px] text-slate-500 dark:text-slate-400">عند التثبيت قد يطلب الموبايل السماح بـ«تثبيت تطبيقات من مصادر غير معروفة»، وافق عليه لهذه المرة.</p>
      )}
      {mine === 'ios' && (
        <p className="text-[12px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2.5">
          تطبيق الآيفون غير متاح حالياً. شاهد المحاضرة من كمبيوتر أو موبايل أندرويد، أو تواصل مع الدكتور.
        </p>
      )}
    </div>
  );
};
