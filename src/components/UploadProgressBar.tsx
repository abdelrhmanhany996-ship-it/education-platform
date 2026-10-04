import React from 'react';
import { UploadCloud, CheckCircle2, Film, FileText } from 'lucide-react';

interface UploadProgressBarProps {
  progress: number;
  fileName: string;
  isUploading: boolean;
  fileType?: 'video' | 'pdf' | 'file';
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
  fileName,
  isUploading,
  fileType = 'video'
}) => {
  if (!isUploading) return null;

  const isComplete = progress >= 100;

  return (
    <div className="bg-indigo-50/90 dark:bg-slate-800/90 backdrop-blur-sm border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-4 shadow-lg transition-all animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 shadow-xs">
            {fileType === 'video' ? (
              <Film className="w-5 h-5 animate-pulse" />
            ) : fileType === 'pdf' ? (
              <FileText className="w-5 h-5 animate-pulse" />
            ) : (
              <UploadCloud className="w-5 h-5 animate-bounce" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {fileName || 'جاري رفع الملف...'}
            </h4>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              {isComplete ? 'جاري اكتشَاف وتجميع المقاطع (Assemble)...' : 'جاري الرفع بنظام التدفق المقطّع (Chunked Upload)'}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
            {progress}%
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden p-0.5">
        <div
          className="bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 h-full rounded-full transition-all duration-300 ease-out shadow-xs"
          style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2">
        <span>أجزاء مقسّمة (5MB Chunks) لتجنب انقطاع الشبكة</span>
        {isComplete && (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> تم اكتمال المكونات
          </span>
        )}
      </div>
    </div>
  );
};
