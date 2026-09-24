import React, { useState } from 'react';
import { FACULTIES, FACULTY_DEPARTMENTS } from '../data/faculties';

export { FACULTIES };

export interface FacultyValue {
  faculty: string;
  departments: string[];
}

export const EMPTY_FACULTY: FacultyValue = { faculty: '', departments: [] };

export const facultyError = (v: FacultyValue) =>
  !v.faculty.trim() ? 'اختر الكلية' : !v.departments.length ? 'اختر قسماً واحداً على الأقل' : '';

export const departmentText = (v: FacultyValue) => v.departments.join('، ');

const OTHER = '__other__';

interface Props {
  value: FacultyValue;
  onChange: (v: FacultyValue) => void;
  selectClassName: string;
  labelClassName: string;
}

/**
 * The one faculty/department chooser used by every registration form (student sign-up, "add account",
 * doctor accounts). Pick the faculty (or write your own with "أخرى"), then tick its departments
 * (again with an "أخرى" box for a department that is not in the list).
 */
export const FacultyPicker: React.FC<Props> = ({ value, onChange, selectClassName, labelClassName }) => {
  const [facultyIsOther, setFacultyIsOther] = useState(false);
  const [deptOther, setDeptOther] = useState('');
  const [deptOtherOn, setDeptOtherOn] = useState(false);

  const known = FACULTY_DEPARTMENTS[value.faculty] || [];
  const listed = value.departments.filter(d => known.includes(d));

  const setFaculty = (faculty: string) => onChange({ faculty, departments: [] });

  const setDepartments = (listedNext: string[], other = deptOtherOn ? deptOther.trim() : '') =>
    onChange({ ...value, departments: other ? [...listedNext, other] : listedNext });

  const toggle = (d: string) => setDepartments(listed.includes(d) ? listed.filter(x => x !== d) : [...listed, d]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className={labelClassName}>الكلية *</label>
        <select
          value={facultyIsOther ? OTHER : value.faculty}
          onChange={e => {
            const v = e.target.value;
            setFacultyIsOther(v === OTHER);
            setDeptOtherOn(v === OTHER);
            setDeptOther('');
            setFaculty(v === OTHER ? '' : v);
          }}
          className={selectClassName}
          required
        >
          <option value="" disabled>
            اختر الكلية
          </option>
          {FACULTIES.map(f => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          <option value={OTHER}>أخرى</option>
        </select>
        {facultyIsOther && (
          <input
            autoFocus
            value={value.faculty}
            onChange={e => onChange({ faculty: e.target.value, departments: value.departments })}
            placeholder="اكتب اسم الكلية"
            className={selectClassName}
            required
          />
        )}
      </div>

      {(value.faculty.trim() || facultyIsOther) && (
        <div className="space-y-2">
          <label className={labelClassName}>القسم * (يمكن اختيار أكثر من قسم)</label>
          <div className="grid grid-cols-2 gap-2">
            {known.map(d => (
              <label
                key={d}
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                  listed.includes(d)
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-950 dark:text-indigo-100 font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <input type="checkbox" checked={listed.includes(d)} onChange={() => toggle(d)} />
                {d}
              </label>
            ))}
            <label
              className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                deptOtherOn
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={deptOtherOn}
                onChange={e => {
                  setDeptOtherOn(e.target.checked);
                  setDepartments(listed, e.target.checked ? deptOther.trim() : '');
                }}
              />
              أخرى
            </label>
          </div>
          {deptOtherOn && (
            <input
              value={deptOther}
              onChange={e => {
                setDeptOther(e.target.value);
                setDepartments(listed, e.target.value.trim());
              }}
              placeholder="اكتب اسم القسم"
              className={selectClassName}
            />
          )}
        </div>
      )}
    </div>
  );
};
