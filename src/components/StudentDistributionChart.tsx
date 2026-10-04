import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { User } from '../types';
import { PieChart as PieIcon, Layers, Award, AlertTriangle, Users, BarChart3 } from 'lucide-react';

interface StudentAnalytics {
  hasAbsenceAlarm?: boolean;
  hasPerformanceAlarm?: boolean;
  lastQuizzesAverage?: number;
  attendanceRate?: number;
}

interface Props {
  students: User[];
  alarms: Map<string, StudentAnalytics>;
  onSelectFilter?: (filterMode: 'all' | 'absence_alarms' | 'drop_alarms' | 'top_performers') => void;
}

type ChartMode = 'performance' | 'department';

interface ChartDataItem {
  name: string;
  value: number;
  color: string;
  description: string;
  filterKey?: 'all' | 'absence_alarms' | 'drop_alarms' | 'top_performers';
}

const PERFORMANCE_COLORS = {
  excellent: '#10b981', // Emerald
  veryGood: '#0284c7',  // Sky
  good: '#f59e0b',      // Amber
  needsFollowup: '#f43f5e' // Rose
};

const DEPARTMENT_COLORS = [
  '#6366f1', // Indigo
  '#0284c7', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316'  // Orange
];

export const StudentDistributionChart: React.FC<Props> = ({ students, alarms, onSelectFilter }) => {
  const [chartMode, setChartMode] = useState<ChartMode>('performance');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // 1. Compute Performance Distribution
  const performanceData = useMemo<ChartDataItem[]>(() => {
    let excellent = 0;
    let veryGood = 0;
    let good = 0;
    let needsFollowup = 0;

    students.forEach(s => {
      const a = alarms.get(s.id);
      const avg = a?.lastQuizzesAverage ?? 0;
      const hasAlarm = a?.hasAbsenceAlarm || a?.hasPerformanceAlarm;

      if (hasAlarm || avg < 50) {
        needsFollowup++;
      } else if (avg >= 85) {
        excellent++;
      } else if (avg >= 70) {
        veryGood++;
      } else {
        good++;
      }
    });

    return [
      {
        name: 'ممتاز (85%+)',
        value: excellent,
        color: PERFORMANCE_COLORS.excellent,
        description: 'أداء عالي وحضور متفاعل',
        filterKey: 'top_performers' as const
      },
      {
        name: 'جيد جداً (70-84%)',
        value: veryGood,
        color: PERFORMANCE_COLORS.veryGood,
        description: 'مستوى متفوق ومستقر'
      },
      {
        name: 'جيد (50-69%)',
        value: good,
        color: PERFORMANCE_COLORS.good,
        description: 'مستوى مقبول يحتاج تحفيز'
      },
      {
        name: 'بحاجة لمتابعة / إنذار',
        value: needsFollowup,
        color: PERFORMANCE_COLORS.needsFollowup,
        description: 'انخفاض بالأداء أو غياب متكرر',
        filterKey: 'absence_alarms' as const
      }
    ].filter(item => item.value > 0);
  }, [students, alarms]);

  // 2. Compute Department/Group Distribution
  const departmentData = useMemo<ChartDataItem[]>(() => {
    const counts: Record<string, number> = {};

    students.forEach(s => {
      const dept = s.department?.trim() || 'عام / غير محدد';
      counts[dept] = (counts[dept] || 0) + 1;
    });

    const items = Object.entries(counts).map(([name, count], index) => ({
      name,
      value: count,
      color: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
      description: `عدد الطلاب: ${count}`
    }));

    // Sort by count descending
    return items.sort((a, b) => b.value - a.value);
  }, [students]);

  const activeData = chartMode === 'performance' ? performanceData : departmentData;
  const totalStudents = students.length;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: ChartDataItem = payload[0].payload;
      const percentage = totalStudents > 0 ? ((data.value / totalStudents) * 100).toFixed(1) : '0';
      return (
        <div className="bg-slate-900/95 text-white border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs backdrop-blur-md">
          <div className="flex items-center gap-2 font-bold mb-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
            <span>{data.name}</span>
          </div>
          <div className="text-slate-300 font-medium">
            العدد: <span className="font-bold text-white">{data.value} طالب</span> ({percentage}%)
          </div>
          <div className="text-[11px] text-slate-400 mt-1 border-t border-slate-800 pt-1">
            {data.description}
          </div>
        </div>
      );
    };
    return null;
  };

  return (
    <div className="surface p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-xs">
      {/* Header with toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <PieIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              توزيع الطلاب والمستويات
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تحليل إحصائي دقيق لإجمالي {totalStudents} طالب بالمنصة
            </p>
          </div>
        </div>

        {/* Chart View Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => { setChartMode('performance'); setActiveIndex(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              chartMode === 'performance'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            مستويات الأداء
          </button>
          <button
            type="button"
            onClick={() => { setChartMode('department'); setActiveIndex(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              chartMode === 'department'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            الأقسام / المجموعات
          </button>
        </div>
      </div>

      {totalStudents === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          لا يوجد طلاب مسجلون حالياً لعرض المخطط البياني.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Recharts Pie Container */}
          <div className="lg:col-span-6 h-64 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {activeData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="transparent"
                      className="transition-all duration-300 cursor-pointer"
                      style={{
                        filter: activeIndex === index ? 'drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.35))' : 'none',
                        transform: activeIndex === index ? 'scale(1.04)' : 'scale(1)',
                        transformOrigin: 'center center'
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">
                {totalStudents}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                طالب
              </span>
            </div>
          </div>

          {/* Breakdown Legend List */}
          <div className="lg:col-span-6 space-y-2.5">
            {activeData.map((item, index) => {
              const pct = totalStudents > 0 ? ((item.value / totalStudents) * 100).toFixed(1) : '0';
              const isHovered = activeIndex === index;

              return (
                <div
                  key={item.name}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => item.filterKey && onSelectFilter?.(item.filterKey)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                    isHovered
                      ? 'bg-slate-100 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 shadow-xs'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/80 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                      {item.value} <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">طالب</span>
                    </div>
                    <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      {pct}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
