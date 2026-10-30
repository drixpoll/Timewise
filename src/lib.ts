import type { Block, Category, Preferences, TimerState } from './types';

const BLOCK_KEY = 'time-block-planner.blocks.v1';
const TIMER_KEY = 'time-block-planner.timer.v1';
const PREF_KEY = 'time-block-planner.preferences.v1';

export const categories: Record<Category, { name: string; color: string }> = {
  work: { name: 'Deep work', color: '#466bd4' },
  study: { name: 'Study', color: '#9b73d2' },
  break: { name: 'Break', color: '#e2a457' },
  personal: { name: 'Personal', color: '#4cae91' }
};

export function asDate(date: string): Date { return new Date(`${date}T12:00:00`); }
export function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
export function shiftDate(key: string, days: number): string {
  const date = asDate(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
export function formatDate(key: string, options: Intl.DateTimeFormatOptions): string {
  return asDate(key).toLocaleDateString('en-US', options);
}
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
export function durationMinutes(block: Pick<Block, 'start' | 'end'>): number {
  return Math.max(0, timeToMinutes(block.end) - timeToMinutes(block.start));
}
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return minutes % 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes / 60}h`;
}
export function displayTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(safe / 3600), m = Math.floor((safe % 3600) / 60), s = safe % 60;
  return h ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
const freshId = () => globalThis.crypto?.randomUUID?.() ?? `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export { freshId };

function sample(): Block[] {
  const today = dateKey(new Date());
  return [
    { title: 'Plan my priorities', start: '08:30', end: '09:00', category: 'personal', notes: 'Pick the most important tasks for today.' },
    { title: 'Deep work · build something', start: '09:00', end: '10:30', category: 'work', notes: 'No distractions. One task at a time.' },
    { title: 'Study & practice', start: '11:00', end: '12:00', category: 'study', notes: 'Review notes and try a practical exercise.' },
    { title: 'Lunch & recharge', start: '12:00', end: '12:45', category: 'break', notes: 'Step away from the screen.' }
  ].map(b => ({ ...b, id: freshId(), date: today, completed: false, actualSeconds: 0 } as Block));
}
function readJSON(key: string): unknown {
  try { const data = localStorage.getItem(key); return data === null ? null : JSON.parse(data); }
  catch { return null; }
}
export function loadBlocks(): Block[] {
  try {
    if (localStorage.getItem(BLOCK_KEY) === null) return sample();
    const value = readJSON(BLOCK_KEY);
    if (!Array.isArray(value)) return [];
    return value.filter((b): b is Block => Boolean(b && typeof b.id === 'string' && typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) && typeof b.title === 'string' && /^\d{2}:\d{2}$/.test(b.start) && /^\d{2}:\d{2}$/.test(b.end) && Object.hasOwn(categories, b.category)))
      .map(b => ({ ...b, completed: Boolean(b.completed), notes: String(b.notes ?? ''), actualSeconds: Number.isFinite(b.actualSeconds) ? Math.max(0, b.actualSeconds) : 0 }));
  } catch { return []; }
}
export function saveBlocks(blocks: Block[]) { try { localStorage.setItem(BLOCK_KEY, JSON.stringify(blocks)); } catch { /* Storage blocked or full. */ } }
export function loadTimer(): TimerState | null {
  const t = readJSON(TIMER_KEY);
  if (!t || typeof t !== 'object') return null;
  const v = t as Partial<TimerState>;
  if (typeof v.blockId !== 'string' || typeof v.remainingSeconds !== 'number' || !Number.isFinite(v.remainingSeconds) || typeof v.isRunning !== 'boolean') return null;
  return { blockId: v.blockId, remainingSeconds: Math.max(0, v.remainingSeconds), isRunning: v.isRunning, lastTickAt: typeof v.lastTickAt === 'number' ? v.lastTickAt : null };
}
export function saveTimer(timer: TimerState | null) { try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); } catch { /* ignore */ } }
export function secondsLeft(timer: TimerState | null, now: number): number {
  if (!timer) return 0;
  return Math.max(0, timer.remainingSeconds - (timer.isRunning && timer.lastTickAt !== null ? Math.max(0, (now - timer.lastTickAt) / 1000) : 0));
}
export function loadPreferences(): Preferences {
  const v = readJSON(PREF_KEY) as Partial<Preferences> | null;
  return { dailyGoal: typeof v?.dailyGoal === 'number' && v.dailyGoal >= 30 && v.dailyGoal <= 720 ? v.dailyGoal : 240, notifications: Boolean(v?.notifications) };
}
export function savePreferences(prefs: Preferences) { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } }
export function getWeekStart(key: string): string {
  const date = asDate(key);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKey(date);
}
export function daySummary(blocks: Block[], date: string) {
  const items = blocks.filter(b => b.date === date);
  const planned = items.filter(b => b.category !== 'break').reduce((sum, b) => sum + durationMinutes(b), 0);
  const completed = items.filter(b => b.completed && b.category !== 'break').reduce((sum, b) => sum + durationMinutes(b), 0);
  const finished = items.filter(b => b.completed).length;
  return { items, planned, completed, finished, total: items.length, percent: planned ? Math.round(completed / planned * 100) : 0 };
}
