import React, { createContext, useContext, useEffect, useState } from 'react';
import { Languages } from 'lucide-react';

export type Language = 'ar' | 'en';

interface LanguageCtx {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const Ctx = createContext<LanguageCtx | undefined>(undefined);
const KEY = 'lms_language';

const translations: Record<Language, Record<string, string>> = {
  ar: {
    settings: 'الإعدادات',
    appearance: 'المظهر واللغة',
    theme: 'وضع الشاشة (الداكن والنهار)',
    light: 'فاتح',
    dark: 'داكن',
    system: 'تلقائي',
    language: 'لغة المنصة',
    arabic: 'العربية',
    english: 'English',
    students: 'الطلاب',
    search_placeholder: 'بحث بالاسم أو الكود أو الهاتف',
    load_more: 'تحميل المزيد (+10 طلاب)',
    showing_students: 'عرض {count} من إجمالي {total} طالب',
    all_students: 'الكل',
    absence_alarms: 'غياب',
    drop_alarms: 'هبوط أداء',
    top_performers: 'المتصدرون',
    save: 'حفظ',
    saved: 'تم الحفظ بنجاح',
    my_account: 'حسابي',
    dashboard: 'لوحة التحكم',
    courses: 'المقررات',
    logout: 'تسجيل الخروج',
    // Nav labels
    'نظرة عامة': 'نظرة عامة',
    'الطلاب': 'الطلاب',
    'طلبات التسجيل': 'طلبات التسجيل',
    'المقررات والمحاضرات': 'المقررات والمحاضرات',
    'إنشاء كويز من PDF': 'إنشاء كويز من PDF',
    'تصحيح المقالي': 'تصحيح المقالي',
    'المجموعات': 'المجموعات',
    'لوحة الشرف': 'لوحة الشرف',
    'التنبيهات والرسائل': 'التنبيهات والرسائل',
    'المحادثات': 'المحادثات',
    'سجل النشاط': 'سجل النشاط',
    'الشهادات': 'الشهادات',
    'الإعدادات': 'الإعدادات',
    'محاضراتي': 'محاضراتي',
    'شهادتي': 'شهادتي',
    'تواصل مع الدكتور': 'تواصل مع الدكتور',
    'طلبات التسجيل والدفع': 'طلبات التسجيل والدفع',
    'الرسائل': 'الرسائل',
    'ملفات PDF': 'ملفات PDF',
    // Nav groups
    'الرئيسية': 'الرئيسية',
    'المحتوى': 'المحتوى',
    'المتابعة': 'المتابعة',
    'الإنجاز': 'الإنجاز',
    'النظام': 'النظام',
    'دراستي': 'دراستي',
    'المهام': 'المهام',
    // Dashboard headers & buttons
    'إحصائيات المنصة': 'إحصائيات المنصة',
    'إجمالي الطلاب': 'إجمالي الطلاب',
    'نسبة الحضور': 'نسبة الحضور',
    'متوسط الدرجات': 'متوسط الدرجات',
    'الشهادات المصدرة': 'الشهادات المصدرة',
    'تصدير Excel': 'تصدير Excel',
    'تصدير PDF': 'تصدير PDF',
    'إضافة طالب': 'إضافة طالب',
    'طباعة بيان طالب': 'طباعة بيان طالب',
    'عرض التفاصيل': 'عرض التفاصيل',
    'المستوى الأكاديمي': 'المستوى الأكاديمي',
    'كشف الدرجات': 'كشف الدرجات',
    'قالب الشهادة السريع': 'قالب الشهادة السريع',
    'إصدار وتجهيز الشهادة': 'إصدار وتجهيز الشهادة',
    'اختر الطالب': 'اختر الطالب',
    'نوع الشهادة / اللقب': 'نوع الشهادة / اللقب',
    'إرسال عبر الواتساب': 'إرسال عبر الواتساب',
    'تنزيل ملف PDF': 'تنزيل ملف PDF'
  },
  en: {
    settings: 'Settings',
    appearance: 'Appearance & Language',
    theme: 'Theme Mode (Dark / Light)',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    language: 'Platform Language',
    arabic: 'العربية',
    english: 'English',
    students: 'Students',
    search_placeholder: 'Search by name, ID, or phone',
    load_more: 'Load More (+10 students)',
    showing_students: 'Showing {count} of total {total} students',
    all_students: 'All',
    absence_alarms: 'Absence Alerts',
    drop_alarms: 'Performance Drop',
    top_performers: 'Top Performers',
    save: 'Save',
    saved: 'Saved successfully',
    my_account: 'My Account',
    dashboard: 'Dashboard',
    courses: 'Courses',
    logout: 'Logout',
    // Nav labels
    'نظرة عامة': 'Overview',
    'الطلاب': 'Students',
    'طلبات التسجيل': 'Enrollments',
    'المقررات والمحاضرات': 'Courses & Lectures',
    'إنشاء كويز من PDF': 'Create Quiz from PDF',
    'تصحيح المقالي': 'Essay Grading',
    'المجموعات': 'Groups',
    'لوحة الشرف': 'Leaderboard',
    'التنبيهات والرسائل': 'Alerts & Messages',
    'المحادثات': 'Chat',
    'سجل النشاط': 'Activity Log',
    'الشهادات': 'Certificates',
    'الإعدادات': 'Settings',
    'محاضراتي': 'My Lectures',
    'شهادتي': 'My Certificate',
    'تواصل مع الدكتور': 'Contact Instructor',
    'طلبات التسجيل والدفع': 'Registration & Payment Requests',
    'الرسائل': 'Messages',
    'ملفات PDF': 'PDF Files',
    // Nav groups
    'الرئيسية': 'Main',
    'المحتوى': 'Content',
    'المتابعة': 'Monitoring',
    'الإنجاز': 'Achievement',
    'النظام': 'System',
    'دراستي': 'My Studies',
    'المهام': 'Tasks',
    // Dashboard headers & buttons
    'إحصائيات المنصة': 'Platform Statistics',
    'إجمالي الطلاب': 'Total Students',
    'نسبة الحضور': 'Attendance Rate',
    'متوسط الدرجات': 'Average Score',
    'الشهادات المصدرة': 'Issued Certificates',
    'تصدير Excel': 'Export Excel',
    'تصدير PDF': 'Export PDF',
    'إضافة طالب': 'Add Student',
    'طباعة بيان طالب': 'Print Student Report',
    'عرض التفاصيل': 'View Details',
    'المستوى الأكاديمي': 'Academic Performance',
    'كشف الدرجات': 'Grade Transcript',
    'قالب الشهادة السريع': 'Instant Certificate Template',
    'إصدار وتجهيز الشهادة': 'Generate & Issue Certificate',
    'اختر الطالب': 'Select Student',
    'نوع الشهادة / اللقب': 'Certificate Type / Title',
    'إرسال عبر الواتساب': 'Send via WhatsApp',
    'تنزيل ملف PDF': 'Download PDF'
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(KEY);
      return saved === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
  };

  const t = (key: string): string => {
    if (!key) return '';
    if (language === 'en') {
      if (translations.en[key]) return translations.en[key];
      const trimmed = key.trim();
      if (translations.en[trimmed]) return translations.en[trimmed];
      // Case-insensitive lookup fallback
      const lower = trimmed.toLowerCase();
      const found = Object.entries(translations.en).find(
        ([k]) => k.trim().toLowerCase() === lower
      );
      if (found) return found[1];
    }
    return translations[language]?.[key] || translations['ar']?.[key] || key;
  };

  return <Ctx.Provider value={{ language, setLanguage, t }}>{children}</Ctx.Provider>;
};

export const useLanguage = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLanguage must be used within LanguageProvider');
  return c;
};

export const LanguageSwitch: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
        <Languages className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        {t('language')}
      </label>
      <div role="radiogroup" aria-label={t('language')} className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
        <button
          type="button"
          role="radio"
          aria-checked={language === 'ar'}
          onClick={() => setLanguage('ar')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            language === 'ar'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <span className="font-sans text-[11px] bg-slate-200/50 dark:bg-slate-700/50 px-1 rounded text-slate-700 dark:text-slate-200">EG</span>
          <span>العربية</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={language === 'en'}
          onClick={() => setLanguage('en')}
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            language === 'en'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <span className="font-sans text-[11px] bg-slate-200/50 dark:bg-slate-700/50 px-1 rounded text-slate-700 dark:text-slate-200">US</span>
          <span>English</span>
        </button>
      </div>
    </div>
  );
};
