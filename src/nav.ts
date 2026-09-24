import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BookOpen,
  ClipboardCheck,
  FileDown,
  GraduationCap,
  LayoutDashboard,
  Bell,
  MessageSquare,
  ScrollText,
  Settings,
  Trophy,
  UserCog,
  Upload,
  Users,
  UserPlus,
  UsersRound
} from 'lucide-react';

export type DoctorPage =
  | 'overview'
  | 'students'
  | 'enrollments'
  | 'courses'
  | 'quizImport'
  | 'grading'
  | 'groups'
  | 'leaderboard'
  | 'certificates'
  | 'alerts'
  | 'chat'
  | 'activity'
  | 'settings';

export type StudentPage = 'lectures' | 'leaderboard' | 'certificate' | 'chat' | 'account';

export type AssistantPage = 'enrollments' | 'messages' | 'chat' | 'files';

export type PageId = DoctorPage | StudentPage | AssistantPage;

export interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
  group: string;
  /** Which live counter to show next to the item. */
  badge?: 'grading' | 'alerts' | 'enrollments' | 'chat';
}

export const DOCTOR_NAV: NavItem[] = [
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, group: 'الرئيسية' },
  { id: 'students', label: 'الطلاب', icon: Users, group: 'الرئيسية' },
  { id: 'enrollments', label: 'طلبات التسجيل', icon: UserPlus, group: 'الرئيسية', badge: 'enrollments' },
  { id: 'courses', label: 'المقررات والمحاضرات', icon: BookOpen, group: 'المحتوى' },
  { id: 'quizImport', label: 'إنشاء كويز من PDF', icon: Upload, group: 'المحتوى' },
  { id: 'grading', label: 'تصحيح المقالي', icon: ClipboardCheck, group: 'المحتوى', badge: 'grading' },
  { id: 'groups', label: 'المجموعات', icon: UsersRound, group: 'المحتوى' },
  { id: 'leaderboard', label: 'لوحة الشرف', icon: Trophy, group: 'المتابعة' },
  { id: 'alerts', label: 'التنبيهات والرسائل', icon: Bell, group: 'المتابعة', badge: 'alerts' },
  { id: 'chat', label: 'المحادثات', icon: MessageSquare, group: 'المتابعة', badge: 'chat' },
  { id: 'activity', label: 'سجل النشاط', icon: ScrollText, group: 'المتابعة' },
  { id: 'certificates', label: 'الشهادات', icon: Award, group: 'الإنجاز' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, group: 'النظام' }
];

export const STUDENT_NAV: NavItem[] = [
  { id: 'lectures', label: 'محاضراتي', icon: GraduationCap, group: 'دراستي' },
  { id: 'leaderboard', label: 'لوحة الشرف', icon: Trophy, group: 'دراستي' },
  { id: 'certificate', label: 'شهادتي', icon: Award, group: 'دراستي' },
  { id: 'chat', label: 'تواصل مع الدكتور', icon: MessageSquare, group: 'دراستي', badge: 'chat' },
  { id: 'account', label: 'حسابي', icon: UserCog, group: 'دراستي' }
];

export const ASSISTANT_NAV: NavItem[] = [
  { id: 'enrollments', label: 'طلبات التسجيل والدفع', icon: UserPlus, group: 'المهام', badge: 'enrollments' },
  { id: 'messages', label: 'الرسائل', icon: Bell, group: 'المهام' },
  { id: 'chat', label: 'المحادثات', icon: MessageSquare, group: 'المهام', badge: 'chat' },
  { id: 'files', label: 'ملفات PDF', icon: FileDown, group: 'المهام' }
];
