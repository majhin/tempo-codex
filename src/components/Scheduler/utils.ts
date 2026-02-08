import type { UniqueIdentifier } from '@dnd-kit/core';
import type { Appointment, DayLayout, SchedulerCssVarStyle, SchedulerView } from './types';

type DateInput = Date | number | string;

const MAX_DESC_CHARS = 120;

export const START_HOUR = 0;
export const END_HOUR = 24;
export const MIN_DAY_MINUTES = START_HOUR * 60;
export const MAX_DAY_MINUTES = END_HOUR * 60;
export const DEFAULT_WORK_START_MINUTES = 9 * 60 + 30;
export const DEFAULT_WORK_END_MINUTES = 19 * 60 + 30;
export const SLOT_MINUTES = 15;
export const SLOT_HEIGHT = 30;
export const SLOT_COUNT = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
export const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
export const DEFAULT_TASK_MINUTES = 30;
export const DEFAULT_TASK_SLOTS = Math.max(1, Math.round(DEFAULT_TASK_MINUTES / SLOT_MINUTES));
export const DAY_START_MINUTES = MIN_DAY_MINUTES;
export const DAY_END_MINUTES = MAX_DAY_MINUTES;
export const DRAG_OVERLAY_NUDGE_X = 10;
export const DRAG_OVERLAY_NUDGE_Y = 10;
export const SETTLE_ANIMATION_MS = 240;

export const createSchedulerCssVars = (slotCount: number): SchedulerCssVarStyle => ({
  '--slot-height': SLOT_HEIGHT,
  '--slot-count': slotCount,
  '--settle-ms': `${SETTLE_ANIMATION_MS}ms`,
});

export const schedulerCssVars: SchedulerCssVarStyle = createSchedulerCssVars(SLOT_COUNT);

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const startOfDay = (date: DateInput): Date => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

export const dayWithMinutes = (day: DateInput, totalMinutes: number): Date => {
  const value = startOfDay(day);
  value.setMinutes(totalMinutes, 0, 0);
  return value;
};

export const endOfDay = (date: DateInput): Date => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

export const startOfWeek = (date: DateInput): Date => {
  const value = startOfDay(date);
  const day = value.getDay();
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  return value;
};

export const endOfWeek = (date: DateInput): Date => {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  value.setHours(23, 59, 59, 999);
  return value;
};

export const startOfMonth = (date: DateInput): Date => {
  const value = startOfDay(date);
  value.setDate(1);
  return value;
};

export const endOfMonth = (date: DateInput): Date => {
  const value = startOfMonth(date);
  value.setMonth(value.getMonth() + 1);
  value.setDate(0);
  value.setHours(23, 59, 59, 999);
  return value;
};

export const sameDay = (a: DateInput, b: DateInput): boolean => startOfDay(a).getTime() === startOfDay(b).getTime();
export const dayKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
export const minutesOfDay = (date: Date): number => date.getHours() * 60 + date.getMinutes();
export const durationMinutes = (
  entry: Pick<Appointment, 'startDate' | 'endDate'>,
  minBlockMinutes: number = SLOT_MINUTES,
): number =>
  Math.max(
    minBlockMinutes,
    Math.round((new Date(entry.endDate).getTime() - new Date(entry.startDate).getTime()) / 60000),
  );

export const fmtDay = (date: Date): string => new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
export const fmtDate = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
export const fmtTime = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
export const fmtDurationCompact = (minutes: number): string => {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
};

export const issueKeyForEntry = (entry: Pick<Appointment, 'id' | 'issueKey'>): string =>
  entry.issueKey || `DD-${870 + entry.id}`;

export const previewDescription = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= MAX_DESC_CHARS) return text;
  return `${text.slice(0, MAX_DESC_CHARS - 1).trimEnd()}...`;
};

export const densityClassForMinutes = (minutes: number): string => {
  if (minutes <= 30) return 'entry-tiny';
  if (minutes <= 60) return 'entry-compact';
  return '';
};

export const fmtWeek = (date: Date): string => `${fmtDate(startOfWeek(date))} - ${fmtDate(endOfWeek(date))}`;
export const fmtHour = (
  slotIndex: number,
  startMinutes: number = MIN_DAY_MINUTES,
  slotMinutes: number = SLOT_MINUTES,
): string =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true }).format(
    new Date(2026, 0, 1, 0, startMinutes + slotIndex * slotMinutes),
  );
export const toInputDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const fromInputDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const daysForView = (view: SchedulerView, selectedDate: Date): Date[] => {
  if (view === 'day') return [startOfDay(selectedDate)];
  const weekStart = startOfWeek(selectedDate);
  const count = view === 'workWeek' ? 5 : 7;
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return day;
  });
};

export const buildMonthCells = (selectedDate: Date): Array<{ day: Date; inMonth: boolean }> => {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const gridStart = startOfWeek(monthStart);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(day.getDate() + index);
    return { day, inMonth: day >= monthStart && day <= monthEnd };
  });
};

export const hoursInRange = (entries: Appointment[], from: Date, to: Date): number =>
  entries
    .filter((entry) => {
      const when = new Date(entry.startDate);
      return when >= from && when <= to;
    })
    .reduce((sum, entry) => sum + (entry.timeSpent || 0), 0);

export const buildDayLayout = (entries: Appointment[], slotMinutes: number = SLOT_MINUTES): DayLayout => {
  const sorted = [...entries].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const laneEnds: number[] = [];
  const laneById = new Map<number, number>();
  sorted.forEach((entry) => {
    const start = minutesOfDay(new Date(entry.startDate));
    const end = start + durationMinutes(entry, slotMinutes);
    let lane = laneEnds.findIndex((laneEnd) => start >= laneEnd);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    laneById.set(entry.id, lane);
  });
  return { laneById, laneCount: Math.max(1, laneEnds.length) };
};

export const toDragId = (entryId: number): string => `entry:${entryId}`;
export const fromDragId = (dragId: UniqueIdentifier | null | undefined): number | null => {
  const raw = String(dragId || '');
  if (!raw.startsWith('entry:')) return null;
  const parsed = Number(raw.slice(6));
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseDayKey = (value: string): Date | null => {
  const [year, month, day] = String(value).split('-').map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;
  return new Date(year, month, day);
};
