/**
 * Identifies this browser for the one-device-per-student rule.
 * - id: random, kept in localStorage (new after clearing site data or in another browser)
 * - fp: a fingerprint of stable browser/screen traits, so clearing site data alone does not look like a new device
 */
const KEY = 'lms_device_id';
let memoryId = '';
let fresh = false;

export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^\w-]/g, '');
      localStorage.setItem(KEY, id);
      fresh = true;
    }
    return id;
  } catch {
    // Storage blocked (private mode etc.): one id per page load
    if (!memoryId) {
      memoryId = `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      fresh = true;
    }
    return memoryId;
  }
}

/** True when the id was created in this page load (site data cleared, or first visit). */
export const deviceIsFresh = () => (deviceId(), fresh);

let fpCache = '';
export function deviceFingerprint(): string {
  if (fpCache) return fpCache;
  const n = navigator as Navigator & { deviceMemory?: number };
  const traits = [
    n.userAgent,
    n.platform,
    n.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    n.hardwareConcurrency,
    n.deviceMemory,
    n.maxTouchPoints
  ].join('|');
  // FNV-1a, 2 rounds with different seeds -> 64 bits of hex
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < traits.length; i++) {
      h ^= traits.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  fpCache = fnv(2166136261) + fnv(374761393);
  return fpCache;
}

export const deviceHeaders = (): Record<string, string> => ({ 'X-Device-Id': deviceId(), 'X-Device-Fp': deviceFingerprint() });
