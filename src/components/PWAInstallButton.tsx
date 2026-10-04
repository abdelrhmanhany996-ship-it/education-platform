import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-3.5 py-1.5 text-xs shadow-md shadow-amber-500/20 transition duration-200 active:scale-95"
        title="تثبيت المنصة كتطبيق على الجهاز"
      >
        <Download className="w-3.5 h-3.5" />
        <span>تثبيت التطبيق (PWA)</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-xl bg-slate-800 text-amber-400 border border-slate-700 px-3 py-1.5 text-xs font-semibold hover:bg-slate-700 transition"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>تثبيت في iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amber-400" />
                  تثبيت المنصة على iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-3 text-xs leading-relaxed text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-md">1</span>
                  <span>اضغط على زر <strong>المشاركة (Share)</strong> أسفل متصفح Safari.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-md">2</span>
                  <span>اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-md">3</span>
                  <span>اضغط على <strong>إضافة (Add)</strong> بالأعلى لتطبيق المنصة كـ PWA.</span>
                </li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 text-xs transition"
              >
                تم، فهمت
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
