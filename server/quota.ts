import type { CollectionName, Doc, Store } from './store';

/** Same rule the doctor sees in the app: N messages per rolling week and a minimum gap, per channel. */
export async function checkQuota(store: Store, collection: CollectionName, studentId: string) {
  const settings = ((await store.get('settings', 'alertSettings'))?.value as any) || {};
  const max = settings.maxMessagesPerWeek ?? 2;
  const gapHours = settings.minHoursBetween ?? 24;
  const now = Date.now();

  const times = (await store.getAll(collection))
    .filter((l: Doc) => l.studentId === studentId && l.status !== 'failed')
    .map((l: Doc) => new Date(l.sentAt).getTime())
    .filter(t => !Number.isNaN(t));

  const inWeek = times.filter(t => now - t < 7 * 24 * 3600 * 1000).length;
  const last = times.length ? Math.max(...times) : 0;

  if (inWeek >= max) return { ok: false as const, error: `وصلت للحد الأقصى (${max} رسائل أسبوعياً) لهذا الطالب` };
  if (last && now - last < gapHours * 3600 * 1000) {
    return { ok: false as const, error: `يجب مرور ${gapHours} ساعة بين رسالتين لنفس الطالب` };
  }
  return { ok: true as const };
}
