import { GraduationCap, ShieldCheck } from 'lucide-react';

/** One-click demo logins, shown on the landing page and in the sidebar switcher. */
export const DEMO_ACCOUNTS = [
  {
    username: 'doctor',
    name: 'د. عبد الرحمن',
    role: 'دكتور',
    code: 'DOC-101',
    blurb: 'لوحة التحكم الكاملة: الإنذارات، الشهادات، ومعاينة حسابات الطلاب.',
    icon: ShieldCheck,
    tone: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300'
  },
  {
    username: 'ahmed_ali',
    name: 'أحمد علي',
    role: 'طالب',
    code: 'STD-2024-001',
    blurb: 'تجربة الطالب: شرح المحاضرة، تسجيل الحضور، ثم الكويز.',
    icon: GraduationCap,
    tone: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
  },
  {
    username: 'sara_mohamed',
    name: 'سارة محمد',
    role: 'طالبة',
    code: 'STD-2024-002',
    blurb: 'حساب طالبة متقدمة في الترتيب وقريبة من لوحة الشرف.',
    icon: GraduationCap,
    tone: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  },
  {
    username: 'nour_hassan',
    name: 'نور حسن',
    role: 'طالبة',
    code: 'STD-2024-004',
    blurb: 'حساب يُظهر كيف تعمل إنذارات الغياب وهبوط الأداء.',
    icon: GraduationCap,
    tone: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
  }
];
