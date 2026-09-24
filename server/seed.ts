import fs from 'node:fs';
import path from 'node:path';
import {
  INITIAL_USERS,
  INITIAL_COURSES,
  INITIAL_STUDENT_STATES,
  INITIAL_BADGE_POLICY,
  INITIAL_CERTIFICATES,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_WHATSAPP_LOGS
} from '../src/data/mockData';
import { DEFAULT_ALERT_SETTINGS } from '../src/utils/scoring';
import { hashPassword } from './auth';
import { DATA_DIR } from './config';
import type { Doc, Store } from './store';

const DEFAULT_CERT_SETTINGS = { institutionName: 'المنصة التعليمية الأكاديمية', autoApprove: false };

const asDocs = (list: any[]): Doc[] => list.map(x => ({ ...x }));

/** Logs are stored oldest-first so the server order (`_ts`) matches time. The seed arrays are newest-first. */
const oldestFirst = (list: any[]): Doc[] => asDocs([...list].reverse());

export async function seedAll(store: Store) {
  // Demo accounts get real password hashes; plaintext never reaches the database
  const users = INITIAL_USERS.map(u => {
    const { password, ...rest } = u;
    return { ...rest, pw: hashPassword(password || '123456') } as Doc;
  });

  await store.replaceAll('users', users);
  await store.replaceAll('courses', asDocs(INITIAL_COURSES));
  await store.replaceAll('groups', []);
  await store.replaceAll('studentStates', asDocs(INITIAL_STUDENT_STATES));
  await store.replaceAll('certificates', asDocs(INITIAL_CERTIFICATES));
  await store.replaceAll('activityLogs', oldestFirst(INITIAL_ACTIVITY_LOGS));
  await store.replaceAll('whatsappLogs', oldestFirst(INITIAL_WHATSAPP_LOGS));
  await store.replaceAll('telegramLogs', []);

  // Demo students already have an approved seat in the demo course, exactly like before enrollment
  // requests existed, so the seeded experience does not regress.
  const seedCourse = INITIAL_COURSES[0];
  if (seedCourse) {
    const now = new Date().toISOString();
    const enrollments: Doc[] = INITIAL_USERS.filter(u => u.role === 'student').map(u => ({
      id: `enr_seed_${u.id}`,
      studentId: u.id,
      studentName: u.name,
      studentAcademicId: u.academicId,
      studentPhone: u.phone,
      studentEmail: u.email,
      courseId: seedCourse.id,
      courseTitle: seedCourse.title,
      doctorId: seedCourse.doctorId,
      doctorName: seedCourse.doctorName,
      status: 'approved',
      requestedAt: now,
      decidedAt: now,
      decidedBy: seedCourse.doctorName
    }));
    await store.replaceAll('enrollments', enrollments);
  } else {
    await store.replaceAll('enrollments', []);
  }

  await store.replaceAll('settings', [
    { id: 'badgePolicy', value: INITIAL_BADGE_POLICY },
    { id: 'alertSettings', value: DEFAULT_ALERT_SETTINGS },
    { id: 'certSettings', value: DEFAULT_CERT_SETTINGS }
  ]);

  // Uploaded PDFs belong to the old data set
  const uploads = path.join(DATA_DIR, 'uploads');
  if (fs.existsSync(uploads)) fs.rmSync(uploads, { recursive: true, force: true });
}

export async function seedIfEmpty(store: Store) {
  if (await store.isEmpty()) {
    console.log('• First run: loading the demo data set…');
    await seedAll(store);
  }
}
