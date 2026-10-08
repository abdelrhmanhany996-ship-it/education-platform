import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Sparkles, CheckCircle2, Monitor } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    try {
      const wasDismissed = sessionStorage.getItem('pwa_prompt_dismissed');
      if (wasDismissed === 'true') {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    } catch {
      /* ignore */
    }
  };

  // Already inside the protected Android app
  if (isInstalled || dismissed || /AcademicPlatformApp\//.test(navigator.userAgent)) return null;
  if (!isInstallable && !isIOS) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 max-w-md mx-auto animate-rise">
      <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white border border-amber-500/30 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
              تثبيت التطبيق التلقائي
            </div>
            <div className="text-sm font-extrabold text-white truncate">أضف المنصة لشاشتك الرئيسية</div>
            <p className="text-[11px] text-slate-300 truncate">تصفح أسرع وإشعارات وتجربة شبيهة بالتطبيق</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isInstallable ? (
            <button
              onClick={install}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-xl text-xs font-black shadow-md transition active:scale-95 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              تثبيت الآن
            </button>
          ) : isIOS ? (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              تعليمات iPhone
            </button>
          ) : null}

          <button
            onClick={handleDismiss}
            aria-label="إغلاق"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                تثبيت المنصة على iPhone / iPad
              </h3>
              <button onClick={() => setShowIOSGuide(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-xs leading-relaxed text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-md shrink-0">1</span>
                <span>افتح المنصة في متصفح <strong>Safari</strong> واضغط زر <strong>المشاركة (Share ⎋)</strong> بالأسفل.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-md shrink-0">2</span>
                <span>مرر القائمة لأسفل واضغط على <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen ⊕)</strong>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-md shrink-0">3</span>
                <span>اضغط <strong>إضافة (Add)</strong> بالأعلى لتظهر أيقونة التطبيق على شاشتك.</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold py-2.5 text-xs transition"
            >
              تم، فهمت الخطوات
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const HomePWASection: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <section className="surface p-6 sm:p-8 rounded-3xl space-y-6 border border-indigo-100 dark:border-indigo-500/20 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            تطبيق هاتف جاهز (PWA)
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            كيف تضيف المنصة لشاشتك الرئيسية؟
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            استمتع بتجربة تطبيق كاملة وسريعة بدون الحاجة للتحميل من المتجر.
          </p>
        </div>

        {isInstalled ? (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-500/25">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            المنصة مثبّتة بالفعل كـ تطبيق!
          </div>
        ) : isInstallable ? (
          <button
            onClick={install}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-md transition active:scale-95 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            تثبيت المنصة فوراً بضغطة واحدة
          </button>
        ) : isIOS ? (
          <button
            onClick={() => setShowIOSGuide(true)}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-2"
          >
            <Smartphone className="w-4 h-4" />
            عرض تعليمات أجهزة iPhone
          </button>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 pt-2">
        <button
          onClick={() => setActiveTab('android')}
          className={`p-5 rounded-2xl border text-start transition-all ${
            activeTab === 'android'
              ? 'bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-500 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">أندرويد (Android)</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">متصفح Google Chrome / Edge</div>
            </div>
          </div>
          <ol className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">1.</span>
              <span>اضغط على زر <strong>تثبيت التطبيق</strong> بالأسفل أو أعلى الصفحة.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">2.</span>
              <span>أو اضغط القائمة (⋮) واختر <strong>تثبيت التطبيق (Install App)</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">3.</span>
              <span>ستظهر أيقونة المنصة مباشرة في شاشة جهازك الرئيسية.</span>
            </li>
          </ol>
        </button>

        <button
          onClick={() => setActiveTab('ios')}
          className={`p-5 rounded-2xl border text-start transition-all ${
            activeTab === 'ios'
              ? 'bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-500 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">آيفون وآيباد (iOS)</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">متصفح Safari الأصلي</div>
            </div>
          </div>
          <ol className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="font-bold text-amber-600 dark:text-amber-400">1.</span>
              <span>افتح المنصة في Safari واضغط زر <strong>المشاركة (Share ⎋)</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-amber-600 dark:text-amber-400">2.</span>
              <span>اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen ⊕)</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-amber-600 dark:text-amber-400">3.</span>
              <span>تاكّد من الضغط على <strong>إضافة (Add)</strong> بالأعلى.</span>
            </li>
          </ol>
        </button>

        <button
          onClick={() => setActiveTab('desktop')}
          className={`p-5 rounded-2xl border text-start transition-all ${
            activeTab === 'desktop'
              ? 'bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-500 shadow-xs'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100">الكومبيوتر (PC / Mac)</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">متصفح Chrome / Edge</div>
            </div>
          </div>
          <ol className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">1.</span>
              <span>لاحظ ظهور أيقونة التثبيت (⊕) في شريط عنوان المتصفح بالأعلى.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">2.</span>
              <span>اضغط عليها واختر <strong>Install (تثبيت)</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">3.</span>
              <span>تفتح المنصة كنافذة تطبيق مستقلة بسطح المكتب.</span>
            </li>
          </ol>
        </button>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                تثبيت المنصة على iPhone / iPad
              </h3>
              <button onClick={() => setShowIOSGuide(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-xs leading-relaxed text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-md shrink-0">1</span>
                <span>افتح المنصة في متصفح <strong>Safari</strong> واضغط زر <strong>المشاركة (Share ⎋)</strong> بالأسفل.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-md shrink-0">2</span>
                <span>مرر القائمة لأسفل واضغط على <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen ⊕)</strong>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-md shrink-0">3</span>
                <span>اضغط <strong>إضافة (Add)</strong> بالأعلى لتظهر أيقونة التطبيق على شاشتك.</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold py-2.5 text-xs transition"
            >
              تم، فهمت الخطوات
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
