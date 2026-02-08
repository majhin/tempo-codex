import type { DragCancelEvent, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import { DndContext, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { DraggableCard } from './components/DraggableCard';
import { EntryActionMenu } from './components/EntryActionMenu';
import { SchedulerTaskItem } from './components/TaskItem';
import {
  initialAppointments as defaultInitialAppointments,
  projects as defaultProjects,
  taskTypes as defaultTaskTypes,
} from './data';
import type {
  Appointment,
  CreateDraft,
  DayCountStyle,
  DragPoint,
  DragPreview,
  HitZone,
  HoverSlot,
  MouseListeners,
  PointerListeners,
  ResizeDraft,
  ResizeEdge,
  ResizeSession,
  SchedulerProps,
  SchedulerTaskItemProps,
  SchedulerView,
  ThemeMode,
} from './types';
import {
  buildMonthCells,
  clamp,
  createSchedulerCssVars,
  SLOT_MINUTES as DEFAULT_BLOCK_MINUTES,
  DEFAULT_WORK_END_MINUTES,
  DEFAULT_WORK_START_MINUTES,
  DRAG_OVERLAY_NUDGE_X,
  DRAG_OVERLAY_NUDGE_Y,
  dayKey,
  daysForView,
  dayWithMinutes,
  densityClassForMinutes,
  durationMinutes,
  endOfDay,
  endOfWeek,
  fmtDate,
  fmtDay,
  fmtDurationCompact,
  fmtHour,
  fmtTime,
  fmtWeek,
  fromDragId,
  fromInputDate,
  hoursInRange,
  issueKeyForEntry,
  MAX_DAY_MINUTES,
  MIN_DAY_MINUTES,
  minutesOfDay,
  parseDayKey,
  previewDescription,
  SETTLE_ANIMATION_MS,
  SLOT_HEIGHT,
  sameDay,
  startOfDay,
  startOfWeek,
  toInputDate,
} from './utils';
import './Scheduler.css';

const ALL_VIEWS: SchedulerView[] = ['day', 'week', 'workWeek', 'month'];

const VIEW_LABELS: Record<SchedulerView, string> = {
  day: 'Day',
  week: 'Week',
  workWeek: 'Work week',
  month: 'Month',
};

const normalizeTaskItem = (
  item: SchedulerTaskItemProps,
  minBlockMinutes: number = DEFAULT_BLOCK_MINUTES,
): Appointment => {
  const startDate = new Date(item.startDate);
  let endDate = new Date(item.endDate);
  if (endDate.getTime() <= startDate.getTime()) {
    endDate = new Date(startDate.getTime() + minBlockMinutes * 60000);
  }

  const minutes = Math.max(minBlockMinutes, Math.round((endDate.getTime() - startDate.getTime()) / 60000));

  return {
    id: item.id,
    text: item.text,
    startDate,
    endDate,
    projectId: item.projectId,
    taskType: item.taskType,
    description: item.description || '',
    timeSpent: item.timeSpent ?? Math.round((minutes / 60) * 100) / 100,
    issueKey: item.issueKey,
    completed: item.completed,
  };
};

const extractTaskItems = (children: SchedulerProps['children'], minBlockMinutes: number): Appointment[] => {
  const items: Appointment[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<SchedulerTaskItemProps>(child)) return;
    if (child.type !== SchedulerTaskItem) return;
    items.push(normalizeTaskItem(child.props, minBlockMinutes));
  });
  return items;
};

const SchedulerBase = ({
  children,
  projects: projectsProp = defaultProjects,
  taskTypes: taskTypesProp = defaultTaskTypes,
  initialTheme = 'dark',
  initialView = 'week',
  initialDate = new Date(2026, 1, 10),
  config,
  ui,
  features,
  readOnly = false,
  onSubmitWeek,
  onViewChange: onViewChangeProp,
  onDateChange: onDateChangeProp,
  onTaskCreate,
  onTaskDelete,
  onTaskEdit,
  onTaskToggleComplete,
  onTasksChange,
}: SchedulerProps) => {
  const resolvedViews = useMemo<SchedulerView[]>(() => {
    const source = config?.views?.length ? config.views : ALL_VIEWS;
    const unique = Array.from(new Set(source));
    const valid = unique.filter((view): view is SchedulerView => ALL_VIEWS.includes(view));
    return valid.length ? valid : ALL_VIEWS;
  }, [config?.views]);

  const resolvedInitialView = resolvedViews.includes(initialView) ? initialView : resolvedViews[0];
  const resolvedTimeline = useMemo(() => {
    const blockMinutes = config?.blockMinutes ?? DEFAULT_BLOCK_MINUTES;
    const fallbackStartMinutes = DEFAULT_WORK_START_MINUTES;
    const fallbackEndMinutes = DEFAULT_WORK_END_MINUTES;

    const toOffsetMinutes = (value: Date | undefined, referenceDay: Date): number | null => {
      if (!value || Number.isNaN(value.getTime())) return null;
      const refStart = new Date(referenceDay);
      refStart.setHours(0, 0, 0, 0);
      const valueDay = new Date(value);
      valueDay.setHours(0, 0, 0, 0);
      const dayDiff = Math.round((valueDay.getTime() - refStart.getTime()) / 86400000);
      const dayMinutes = value.getHours() * 60 + value.getMinutes();
      return dayDiff * 1440 + dayMinutes;
    };

    const referenceDay = config?.startTime ?? config?.endTime ?? new Date(2026, 0, 1);
    const parsedStart = toOffsetMinutes(config?.startTime, referenceDay);
    const parsedEnd = toOffsetMinutes(config?.endTime, referenceDay);

    const warnings: string[] = [];
    if (config?.startTime !== undefined && parsedStart === null) {
      warnings.push('Invalid startTime; falling back to default start time.');
    }
    if (config?.endTime !== undefined && parsedEnd === null) {
      warnings.push('Invalid endTime; falling back to default end time.');
    }
    if (parsedStart !== null && (parsedStart < MIN_DAY_MINUTES || parsedStart > MAX_DAY_MINUTES)) {
      warnings.push('startTime must be within 12:00 AM and 12:00 AM next day.');
    }
    if (parsedEnd !== null && (parsedEnd < MIN_DAY_MINUTES || parsedEnd > MAX_DAY_MINUTES)) {
      warnings.push('endTime must be within 12:00 AM and 12:00 AM next day.');
    }
    let workStartMinutes = clamp(parsedStart ?? fallbackStartMinutes, MIN_DAY_MINUTES, MAX_DAY_MINUTES);
    let workEndMinutes = clamp(parsedEnd ?? fallbackEndMinutes, MIN_DAY_MINUTES, MAX_DAY_MINUTES);

    if (workEndMinutes <= workStartMinutes) {
      warnings.push('End time must be later than start time.');
      workEndMinutes = Math.min(MAX_DAY_MINUTES, workStartMinutes + 15);
    }
    if (workEndMinutes - workStartMinutes < 15) {
      warnings.push('Start and end must be at least 15 minutes apart.');
      workEndMinutes = Math.min(MAX_DAY_MINUTES, workStartMinutes + 15);
    }
    if (workEndMinutes <= workStartMinutes) {
      workStartMinutes = Math.max(MIN_DAY_MINUTES, MAX_DAY_MINUTES - 15);
      workEndMinutes = MAX_DAY_MINUTES;
    }

    const snappedStart = Math.floor(workStartMinutes / blockMinutes) * blockMinutes;
    const snappedEnd = Math.ceil(workEndMinutes / blockMinutes) * blockMinutes;
    if (snappedStart !== workStartMinutes || snappedEnd !== workEndMinutes) {
      warnings.push(`Times are snapped to ${blockMinutes}-minute boundaries.`);
    }

    workStartMinutes = clamp(snappedStart, MIN_DAY_MINUTES, MAX_DAY_MINUTES - blockMinutes);
    workEndMinutes = clamp(snappedEnd, workStartMinutes + blockMinutes, MAX_DAY_MINUTES);

    const slotCount = Math.max(1, Math.floor((MAX_DAY_MINUTES - MIN_DAY_MINUTES) / blockMinutes));
    const timelineStartMinutes = MIN_DAY_MINUTES;
    const timelineEndMinutes = timelineStartMinutes + slotCount * blockMinutes;

    if (warnings.length > 0 && typeof console !== 'undefined') {
      console.warn(`[Scheduler] ${warnings.join(' ')}`);
    }

    const defaultTaskMinutes = Math.max(30, blockMinutes);

    return {
      startMinutes: timelineStartMinutes,
      endMinutes: timelineEndMinutes,
      workStartMinutes,
      workEndMinutes,
      blockMinutes,
      slotCount,
      slotsPerHour: 60 / blockMinutes,
      defaultTaskMinutes,
      defaultTaskSlots: Math.max(1, Math.round(defaultTaskMinutes / blockMinutes)),
      dayStartMinutes: timelineStartMinutes,
      dayEndMinutes: timelineEndMinutes,
    };
  }, [config?.blockMinutes, config?.endTime, config?.startTime]);

  const START_MINUTES = resolvedTimeline.startMinutes;
  const WORK_START_MINUTES = resolvedTimeline.workStartMinutes;
  const SLOT_MINUTES = resolvedTimeline.blockMinutes;
  const SLOT_COUNT = resolvedTimeline.slotCount;
  const SLOTS_PER_HOUR = resolvedTimeline.slotsPerHour;
  const DEFAULT_TASK_MINUTES = resolvedTimeline.defaultTaskMinutes;
  const DEFAULT_TASK_SLOTS = resolvedTimeline.defaultTaskSlots;
  const DAY_START_MINUTES = resolvedTimeline.dayStartMinutes;
  const DAY_END_MINUTES = resolvedTimeline.dayEndMinutes;
  const schedulerCssVars = useMemo(() => createSchedulerCssVars(SLOT_COUNT), [SLOT_COUNT]);
  const showThemeToggle = ui?.showThemeToggle ?? true;
  const showSubmitButton = ui?.showSubmitButton ?? true;
  const showKpis = ui?.showKpis ?? true;
  const showWeekStrip = ui?.showWeekStrip ?? true;
  const showFilters = ui?.showFilters ?? true;
  const title = ui?.title ?? 'Tempo Timesheets';
  const searchPlaceholder = ui?.searchPlaceholder ?? 'Search logs';
  const submitButtonLabel = ui?.submitButtonLabel ?? 'Submit week for approval';
  const canDrag = !readOnly && (features?.drag ?? true);
  const canResize = !readOnly && (features?.resize ?? true);
  const canCreate = !readOnly && (features?.create ?? true) && typeof onTaskCreate === 'function';
  const canEdit = !readOnly && (features?.edit ?? true) && typeof onTaskEdit === 'function';
  const canDelete = !readOnly && (features?.delete ?? true) && typeof onTaskDelete === 'function';
  const canComplete = !readOnly && (features?.complete ?? true) && typeof onTaskToggleComplete === 'function';

  const childAppointments = useMemo(() => extractTaskItems(children, SLOT_MINUTES), [children, SLOT_MINUTES]);
  const hasTaskChildren = childAppointments.length > 0;
  const controlled = hasTaskChildren && typeof onTasksChange === 'function';

  const [internalAppointments, setInternalAppointments] = useState<Appointment[]>(() =>
    hasTaskChildren ? childAppointments : defaultInitialAppointments,
  );
  const didSeedFromChildrenRef = useRef(false);

  useEffect(() => {
    if (controlled || !hasTaskChildren || didSeedFromChildrenRef.current) return;
    setInternalAppointments(childAppointments);
    didSeedFromChildrenRef.current = true;
  }, [childAppointments, controlled, hasTaskChildren]);

  const appointments = controlled ? childAppointments : internalAppointments;
  const projects = projectsProp;
  const taskTypes = taskTypesProp;

  const updateAppointments = (updater: (prev: Appointment[]) => Appointment[]): void => {
    if (controlled) {
      const next = updater(childAppointments);
      onTasksChange?.(next);
      return;
    }

    setInternalAppointments((prev) => {
      const next = updater(prev);
      onTasksChange?.(next);
      return next;
    });
  };

  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [currentView, setCurrentView] = useState<SchedulerView>(resolvedInitialView);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);
  const [dragOverlayHeight, setDragOverlayHeight] = useState<number | null>(null);
  const [dragPointer, setDragPointer] = useState<DragPoint | null>(null);
  const [hoveredEntryId, setHoveredEntryId] = useState<number | null>(null);
  const [hoverSlot, setHoverSlot] = useState<HoverSlot | null>(null);
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const [scrollbarHot, setScrollbarHot] = useState(false);
  const [settleEntryId, setSettleEntryId] = useState<number | null>(null);
  const [resizeDraft, setResizeDraft] = useState<ResizeDraft | null>(null);
  const dragAnchorSlotRef = useRef<number>(0);
  const dragAnchorPxRef = useRef<DragPoint>({ x: 0, y: 0 });
  const dragStartPointerRef = useRef<DragPoint | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const settleRafRef = useRef<number | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const resizeDraftRef = useRef<ResizeDraft | null>(null);
  const resizeListenersRef = useRef<PointerListeners>({ move: null, up: null });
  const createDraftRef = useRef<CreateDraft | null>(null);
  const createListenersRef = useRef<MouseListeners>({ move: null, up: null });
  const schedulerWrapRef = useRef<HTMLDivElement | null>(null);
  const gridDayRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const monthDayRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 2 },
    }),
  );
  const today = useMemo(() => new Date(), []);

  const updateSelectedDate = (nextDateOrUpdater: Date | ((prev: Date) => Date)): void => {
    setSelectedDate((prev) => {
      const next =
        typeof nextDateOrUpdater === 'function'
          ? (nextDateOrUpdater as (prev: Date) => Date)(prev)
          : new Date(nextDateOrUpdater);
      onDateChangeProp?.(next);
      return next;
    });
  };

  const applyViewChange = (view: SchedulerView): void => {
    setCurrentView(view);
    onViewChangeProp?.(view);
  };

  useEffect(() => {
    if (resolvedViews.includes(currentView)) return;
    const nextView = resolvedViews[0];
    setCurrentView(nextView);
    onViewChangeProp?.(nextView);
  }, [currentView, onViewChangeProp, resolvedViews]);

  const detachResizeListeners = (): void => {
    if (typeof window === 'undefined') return;
    const listeners = resizeListenersRef.current;
    if (listeners.move) window.removeEventListener('pointermove', listeners.move);
    if (listeners.up) {
      window.removeEventListener('pointerup', listeners.up);
      window.removeEventListener('pointercancel', listeners.up);
    }
    resizeListenersRef.current = { move: null, up: null };
  };

  const detachCreateListeners = (): void => {
    if (typeof window === 'undefined') return;
    const listeners = createListenersRef.current;
    if (listeners.move) window.removeEventListener('mousemove', listeners.move);
    if (listeners.up) window.removeEventListener('mouseup', listeners.up);
    createListenersRef.current = { move: null, up: null };
  };

  const setGlobalResizeCursor = (enabled: boolean): void => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('tempo-resizing', enabled);
    document.body.style.cursor = enabled ? 'ns-resize' : '';
  };

  useEffect(
    () => () => {
      setGlobalResizeCursor(false);
      detachResizeListeners();
      detachCreateListeners();
      if (typeof window !== 'undefined' && settleRafRef.current) {
        window.cancelAnimationFrame(settleRafRef.current);
      }
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    resizeDraftRef.current = resizeDraft;
  }, [resizeDraft]);

  useEffect(() => {
    createDraftRef.current = createDraft;
  }, [createDraft]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const edge = 18;
    const onMove = (event: MouseEvent) => {
      const el = schedulerWrapRef.current;
      if (!el) {
        setScrollbarHot(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const insideX = event.clientX >= rect.left && event.clientX <= rect.right;
      const insideY = event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!insideX || !insideY) {
        setScrollbarHot(false);
        return;
      }
      const hasVertical = el.scrollHeight > el.clientHeight + 1;
      const hasHorizontal = el.scrollWidth > el.clientWidth + 1;
      const nearVScrollbar = hasVertical && event.clientX >= rect.right - edge;
      const nearHScrollbar = hasHorizontal && event.clientY >= rect.bottom - edge;
      const next = nearVScrollbar || nearHScrollbar;
      setScrollbarHot((prev) => (prev === next ? prev : next));
    };
    const onLeaveWindow = () => setScrollbarHot(false);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeaveWindow);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeaveWindow);
    };
  }, []);

  useEffect(() => {
    if (currentView === 'month') return;
    if (typeof window === 'undefined') return;
    const visibleDays = daysForView(currentView, selectedDate);
    if (visibleDays.length === 0) return;
    const el = schedulerWrapRef.current;
    if (!el) return;
    const frame = window.requestAnimationFrame(() => {
      const firstDay = gridDayRefs.current.get(dayKey(visibleDays[0]));
      const head = el.querySelector<HTMLElement>('.sched-head');
      if (!firstDay || !head) return;

      const workOffsetPx = ((WORK_START_MINUTES - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT;
      const targetLineTop = firstDay.getBoundingClientRect().top + workOffsetPx;
      const desiredTop = head.getBoundingClientRect().bottom;
      const delta = targetLineTop - desiredTop;
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTop = clamp(el.scrollTop + delta, 0, maxTop);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [WORK_START_MINUTES, START_MINUTES, SLOT_MINUTES, currentView, selectedDate]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return appointments.filter((a) => {
      const projectOk = projectFilter === 'all' || a.projectId === Number(projectFilter);
      const typeOk = taskTypeFilter === 'all' || a.taskType === taskTypeFilter;
      const searchOk = !q || a.text.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
      return projectOk && typeOk && searchOk;
    });
  }, [appointments, projectFilter, taskTypeFilter, searchText]);

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekEnd = useMemo(() => endOfWeek(selectedDate), [selectedDate]);
  const todayHours = useMemo(() => hoursInRange(filtered, startOfDay(today), endOfDay(today)), [filtered, today]);
  const weekHours = useMemo(() => hoursInRange(filtered, weekStart, weekEnd), [filtered, weekStart, weekEnd]);

  const billableHours = useMemo(
    () =>
      filtered
        .filter((entry) => {
          const when = new Date(entry.startDate);
          const inWeek = when >= weekStart && when <= weekEnd;
          return inWeek && Boolean(taskTypes.find((task) => task.id === entry.taskType)?.billable);
        })
        .reduce((sum, entry) => sum + (entry.timeSpent || 0), 0),
    [filtered, weekStart, weekEnd],
  );

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + index);
        return { day, hours: hoursInRange(filtered, startOfDay(day), endOfDay(day)) };
      }),
    [filtered, weekStart],
  );

  const viewDays = useMemo(() => daysForView(currentView, selectedDate), [currentView, selectedDate]);
  const month = useMemo(() => buildMonthCells(selectedDate), [selectedDate]);

  const activeFilters =
    (projectFilter !== 'all' ? 1 : 0) + (taskTypeFilter !== 'all' ? 1 : 0) + (searchText.trim() ? 1 : 0);
  const utilization = Math.max(0, Math.round((weekHours / 40) * 100));
  const slotIndexes = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, index) => index), [SLOT_COUNT]);
  const timeLabelSlots = useMemo(() => {
    const labels: number[] = [];
    for (let slot = 0; slot < SLOT_COUNT; slot += SLOTS_PER_HOUR) {
      labels.push(slot);
    }
    return labels;
  }, [SLOT_COUNT, SLOTS_PER_HOUR]);
  const maxNewTaskStartSlot = Math.max(0, SLOT_COUNT - DEFAULT_TASK_SLOTS);

  const draggingEntry = useMemo(
    () => appointments.find((entry) => entry.id === draggingId) || null,
    [appointments, draggingId],
  );
  const draggingDurationMinutes = useMemo(
    () => (draggingEntry ? durationMinutes(draggingEntry, SLOT_MINUTES) : 0),
    [draggingEntry, SLOT_MINUTES],
  );
  const draggingDensityClass = useMemo(
    () => densityClassForMinutes(draggingDurationMinutes),
    [draggingDurationMinutes],
  );
  const dragSlots = useMemo(
    () => Math.max(1, Math.ceil((draggingDurationMinutes || SLOT_MINUTES) / SLOT_MINUTES)),
    [draggingDurationMinutes, SLOT_MINUTES],
  );

  const entriesForDay = (day: Date): Appointment[] =>
    filtered
      .filter((entry) => sameDay(entry.startDate, day))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const queueSettleAnimation = (id: number): void => {
    if (typeof window !== 'undefined') {
      if (settleRafRef.current) {
        window.cancelAnimationFrame(settleRafRef.current);
      }
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
      setSettleEntryId(null);
      settleRafRef.current = window.requestAnimationFrame(() => {
        settleRafRef.current = null;
        setSettleEntryId(id);
        settleTimeoutRef.current = window.setTimeout(() => {
          setSettleEntryId(null);
          settleTimeoutRef.current = null;
        }, SETTLE_ANIMATION_MS + 40);
      });
      return;
    }
    setSettleEntryId(id);
  };

  const onEntryMouseEnter = (id: number): void => {
    if (draggingId || resizeSessionRef.current) return;
    setHoveredEntryId((prev) => (prev === id ? prev : id));
  };

  const onEntryMouseLeave = (id: number): void => {
    setHoveredEntryId((prev) => (prev === id ? null : prev));
  };

  const moveAppointment = (id: number, nextStart: Date): void => {
    if (!canDrag) return;
    updateAppointments((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const duration = durationMinutes(item, SLOT_MINUTES);
        const startDate = new Date(nextStart);
        const endDate = new Date(startDate.getTime() + duration * 60000);
        return { ...item, startDate, endDate, timeSpent: Math.round((duration / 60) * 100) / 100 };
      }),
    );
    queueSettleAnimation(id);
  };

  const resizeAppointment = (id: number, nextStart: Date, nextEnd: Date): void => {
    if (!canResize) return;
    updateAppointments((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const startDate = new Date(nextStart);
        const endDate = new Date(nextEnd);
        const minutes = Math.max(SLOT_MINUTES, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
        return { ...item, startDate, endDate, timeSpent: Math.round((minutes / 60) * 100) / 100 };
      }),
    );
    queueSettleAnimation(id);
  };

  const editAppointment = (id: number): void => {
    if (!canEdit) return;
    const source = appointments.find((item) => item.id === id);
    if (!source) return;
    onTaskEdit(source);
  };

  const deleteAppointment = (id: number): void => {
    if (!canDelete) return;
    const source = appointments.find((item) => item.id === id);
    if (!source) return;
    if (resizeSessionRef.current?.id === id) {
      stopResizing(false);
    }
    if (draggingId === id) {
      resetDragState();
    }
    if (settleEntryId === id) {
      setSettleEntryId(null);
    }
    onTaskDelete(source);
  };

  const toggleComplete = (id: number): void => {
    if (!canComplete) return;
    const source = appointments.find((item) => item.id === id);
    if (!source) return;
    onTaskToggleComplete(source, !source.completed);
  };

  const resetDragState = () => {
    setHoveredEntryId(null);
    setDraggingId(null);
    setDragPreview(null);
    setDragOverlayWidth(null);
    setDragOverlayHeight(null);
    setDragPointer(null);
    setHoverSlot(null);
    stopCreateSelection(false);
    dragAnchorSlotRef.current = 0;
    dragAnchorPxRef.current = { x: 0, y: 0 };
    dragStartPointerRef.current = null;
  };

  const stopResizing = (commit = true) => {
    const active = resizeSessionRef.current;
    const draft = resizeDraftRef.current;
    detachResizeListeners();
    setGlobalResizeCursor(false);
    resizeSessionRef.current = null;
    resizeDraftRef.current = null;
    setResizeDraft(null);
    const changed =
      active &&
      draft &&
      (minutesOfDay(new Date(draft.startDate)) !== active.startMinutes ||
        minutesOfDay(new Date(draft.endDate)) !== active.endMinutes);
    if (commit && active && draft && draft.id === active.id && changed) {
      resizeAppointment(active.id, draft.startDate, draft.endDate);
    }
  };

  const startResize = (entry: Appointment, edge: ResizeEdge, event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!canResize) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    if (draggingId) {
      resetDragState();
    }
    stopCreateSelection(false);

    const startDate = new Date(entry.startDate);
    const endDate = new Date(entry.endDate);
    const session = {
      id: entry.id,
      edge,
      day: startOfDay(startDate),
      pointerStartY: event.clientY,
      startMinutes: minutesOfDay(startDate),
      endMinutes: minutesOfDay(endDate),
    };
    setHoverSlot(null);
    setGlobalResizeCursor(true);
    const initialDraft = { id: entry.id, startDate, endDate };
    resizeSessionRef.current = session;
    resizeDraftRef.current = initialDraft;
    setResizeDraft(initialDraft);
    setDragPreview(null);

    detachResizeListeners();

    const onMove = (moveEvent: PointerEvent) => {
      const active = resizeSessionRef.current;
      if (!active || active.id !== entry.id) return;
      moveEvent.preventDefault();

      const deltaSlots = Math.round((moveEvent.clientY - active.pointerStartY) / SLOT_HEIGHT);
      const deltaMinutes = deltaSlots * SLOT_MINUTES;

      let nextStartMinutes = active.startMinutes;
      let nextEndMinutes = active.endMinutes;

      if (active.edge === 'top') {
        nextStartMinutes = clamp(
          active.startMinutes + deltaMinutes,
          DAY_START_MINUTES,
          active.endMinutes - SLOT_MINUTES,
        );
      } else {
        nextEndMinutes = clamp(active.endMinutes + deltaMinutes, active.startMinutes + SLOT_MINUTES, DAY_END_MINUTES);
      }

      const nextStart = dayWithMinutes(active.day, nextStartMinutes);
      const nextEnd = dayWithMinutes(active.day, nextEndMinutes);

      setResizeDraft((prev) => {
        if (
          prev &&
          prev.id === active.id &&
          prev.startDate.getTime() === nextStart.getTime() &&
          prev.endDate.getTime() === nextEnd.getTime()
        ) {
          return prev;
        }
        const next = { id: active.id, startDate: nextStart, endDate: nextEnd };
        resizeDraftRef.current = next;
        return next;
      });
    };

    const onUp = () => stopResizing(true);

    resizeListenersRef.current = { move: onMove, up: onUp };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }
  };

  const findZoneAtPoint = (
    mapRef: React.MutableRefObject<Map<string, HTMLDivElement>>,
    x: number,
    y: number,
  ): HitZone | null => {
    for (const [key, element] of mapRef.current.entries()) {
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return { key, rect };
      }
    }
    return null;
  };

  const slotFromDayPointer = (event: React.MouseEvent<HTMLDivElement>, maxSlot: number = SLOT_COUNT - 1): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = clamp(event.clientY - rect.top, 0, rect.height - 1);
    const rawSlot = Math.floor(y / SLOT_HEIGHT);
    return clamp(rawSlot, 0, maxSlot);
  };

  const addTaskAtSlot = (day: Date, slot: number, durationMinutes: number = DEFAULT_TASK_MINUTES): void => {
    if (!canCreate) return;
    const snappedDuration = Math.max(SLOT_MINUTES, Math.round(durationMinutes / SLOT_MINUTES) * SLOT_MINUTES);
    const durationSlots = Math.max(1, Math.ceil(snappedDuration / SLOT_MINUTES));
    const maxStart = Math.max(0, SLOT_COUNT - durationSlots);
    const safeSlot = clamp(slot, 0, maxStart);

    const startDate = dayWithMinutes(day, START_MINUTES + safeSlot * SLOT_MINUTES);

    const endDate = new Date(startDate.getTime() + snappedDuration * 60000);

    const projectId = projectFilter === 'all' ? projects[0]?.id || 1 : Number(projectFilter);
    const taskType = taskTypeFilter === 'all' ? taskTypes[0]?.id || 'development' : taskTypeFilter;
    const baseDraft: Omit<Appointment, 'id'> = {
      text: 'New task',
      startDate,
      endDate,
      projectId,
      taskType,
      description: '',
      timeSpent: snappedDuration / 60,
      completed: false,
    };
    onTaskCreate(baseDraft, {
      day: startOfDay(day),
      slot: safeSlot,
      durationMinutes: snappedDuration,
    });
  };

  const stopCreateSelection = (commit = true) => {
    if (!canCreate) {
      detachCreateListeners();
      createDraftRef.current = null;
      setCreateDraft(null);
      return;
    }
    const active = createDraftRef.current;
    detachCreateListeners();
    createDraftRef.current = null;
    setCreateDraft(null);
    if (!commit || !active) return;
    const minSlot = Math.min(active.startSlot, active.endSlot);
    const maxSlot = Math.max(active.startSlot, active.endSlot);
    const draggedSlots = Math.max(1, maxSlot - minSlot + 1);
    const durationMinutes = draggedSlots === 1 ? DEFAULT_TASK_MINUTES : draggedSlots * SLOT_MINUTES;
    addTaskAtSlot(active.dayDate, minSlot, durationMinutes);
  };

  const startCreateSelection = (day: Date, event: React.MouseEvent<HTMLDivElement>): void => {
    if (!canCreate) return;
    if (event.button !== 0) return;
    if (draggingId || resizeSessionRef.current || currentView === 'month') return;
    const target = event.target;
    if (
      typeof Element !== 'undefined' &&
      target instanceof Element &&
      target.closest('.entry,.entry-menu,.entry-resize-handle')
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const slot = slotFromDayPointer(event, SLOT_COUNT - 1);
    const next = {
      day: dayKey(day),
      dayDate: startOfDay(day),
      startSlot: slot,
      endSlot: slot,
    };
    setHoverSlot(null);
    setCreateDraft(next);
    createDraftRef.current = next;

    detachCreateListeners();
    const onMove = (moveEvent: MouseEvent) => {
      const active = createDraftRef.current;
      if (!active) return;
      const dayEl = gridDayRefs.current.get(active.day);
      if (!dayEl) return;
      const rect = dayEl.getBoundingClientRect();
      const y = clamp(moveEvent.clientY - rect.top, 0, rect.height - 1);
      const nextSlot = clamp(Math.floor(y / SLOT_HEIGHT), 0, SLOT_COUNT - 1);
      if (nextSlot === active.endSlot) return;
      const updated = { ...active, endSlot: nextSlot };
      createDraftRef.current = updated;
      setCreateDraft(updated);
    };
    const onUp = () => stopCreateSelection(true);
    createListenersRef.current = { move: onMove, up: onUp };
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  };

  const onDayMouseMove = (day: Date, event: React.MouseEvent<HTMLDivElement>): void => {
    if (!canCreate) return;
    if (draggingId || resizeSessionRef.current || createDraftRef.current || currentView === 'month') return;
    const target = event.target;
    if (
      typeof Element !== 'undefined' &&
      target instanceof Element &&
      target.closest('.entry,.entry-menu,.entry-resize-handle')
    ) {
      setHoverSlot(null);
      return;
    }
    const slot = slotFromDayPointer(event, maxNewTaskStartSlot);
    const dayId = dayKey(day);
    setHoverSlot((prev) => (prev && prev.day === dayId && prev.slot === slot ? prev : { day: dayId, slot }));
  };

  const onDayMouseLeave = () => {
    if (createDraftRef.current) return;
    setHoverSlot(null);
  };

  const onDndDragStart = (event: DragStartEvent): void => {
    if (!canDrag) return;
    if (resizeSessionRef.current) return;
    const id = fromDragId(event.active.id);
    if (!id) return;
    const sourceEntry = appointments.find((entry) => entry.id === id);
    if (!sourceEntry) return;

    stopCreateSelection(false);
    setHoveredEntryId(null);
    setHoverSlot(null);
    setDraggingId(id);

    const sourceNode = typeof document !== 'undefined' ? document.querySelector(`[data-drag-id="${id}"]`) : null;
    const sourceRect = sourceNode?.getBoundingClientRect?.() || null;
    const fallbackRect = event.active.rect.current.initial || event.active.rect.current.translated || null;
    const rect = sourceRect || fallbackRect;

    const overlayWidth = rect?.width ? Math.round(rect.width) : null;
    const overlayHeight = rect?.height ? Math.round(rect.height) : null;
    setDragOverlayWidth(overlayWidth);
    setDragOverlayHeight(overlayHeight);

    const activatorEvent = event.activatorEvent;
    const startX =
      typeof activatorEvent === 'object' &&
      activatorEvent !== null &&
      'clientX' in activatorEvent &&
      typeof activatorEvent.clientX === 'number'
        ? activatorEvent.clientX
        : null;
    const startY =
      typeof activatorEvent === 'object' &&
      activatorEvent !== null &&
      'clientY' in activatorEvent &&
      typeof activatorEvent.clientY === 'number'
        ? activatorEvent.clientY
        : null;

    if (startX !== null && startY !== null) {
      dragStartPointerRef.current = { x: startX, y: startY };
      setDragPointer({ x: startX, y: startY });

      if (rect?.height && rect?.width) {
        const offsetY = clamp(startY - rect.top, 0, rect.height - 1);
        const offsetX = clamp(startX - rect.left, 0, rect.width - 1);
        dragAnchorPxRef.current = { x: offsetX, y: offsetY };
        const entrySlots = Math.max(1, Math.ceil(durationMinutes(sourceEntry, SLOT_MINUTES) / SLOT_MINUTES));
        dragAnchorSlotRef.current = clamp(Math.floor(offsetY / SLOT_HEIGHT), 0, entrySlots - 1);
      } else {
        dragAnchorPxRef.current = { x: 0, y: 0 };
      }
    } else {
      dragStartPointerRef.current = null;
      setDragPointer(null);
      dragAnchorPxRef.current = { x: 0, y: 0 };
    }
  };

  const onDndDragMove = (event: DragMoveEvent): void => {
    if (!canDrag) return;
    if (resizeSessionRef.current) return;
    if (!draggingId) return;
    const start = dragStartPointerRef.current;
    if (!start) return;

    const pointerX = start.x + event.delta.x;
    const pointerY = start.y + event.delta.y;
    setDragPointer({ x: pointerX, y: pointerY });

    if (currentView === 'month') {
      const hit = findZoneAtPoint(monthDayRefs, pointerX, pointerY);
      const next: DragPreview | null = hit ? { mode: 'month', day: hit.key } : null;
      setDragPreview(next);
      return;
    }

    const hit = findZoneAtPoint(gridDayRefs, pointerX, pointerY);
    if (!hit) {
      setDragPreview(null);
      return;
    }

    const relativeY = clamp(pointerY - hit.rect.top, 0, hit.rect.height - 1);
    const pointerSlot = Math.floor(relativeY / SLOT_HEIGHT);
    const topSlot = pointerSlot - dragAnchorSlotRef.current;
    const slot = clamp(topSlot, 0, Math.max(0, SLOT_COUNT - dragSlots));
    const next: DragPreview = { mode: 'grid', day: hit.key, slot };
    setDragPreview(next);
  };

  const onDndDragCancel = (_event: DragCancelEvent): void => {
    if (!canDrag) return;
    if (resizeSessionRef.current) return;
    resetDragState();
  };

  const onDndDragEnd = (_event: DragEndEvent): void => {
    if (!canDrag) return;
    if (resizeSessionRef.current) return;
    if (!draggingId || !dragPreview) {
      resetDragState();
      return;
    }

    if (dragPreview.mode === 'grid') {
      const day = parseDayKey(dragPreview.day);
      if (day) {
        const nextStart = dayWithMinutes(day, START_MINUTES + dragPreview.slot * SLOT_MINUTES);
        moveAppointment(draggingId, nextStart);
      }
      resetDragState();
      return;
    }

    if (dragPreview.mode === 'month') {
      const day = parseDayKey(dragPreview.day);
      const source = appointments.find((entry) => entry.id === draggingId);
      if (day && source) {
        const sourceStart = new Date(source.startDate);
        const nextStart = new Date(day);
        nextStart.setHours(sourceStart.getHours(), sourceStart.getMinutes(), 0, 0);
        moveAppointment(draggingId, nextStart);
      }
      resetDragState();
      return;
    }

    resetDragState();
  };

  const clearFilters = () => {
    setProjectFilter('all');
    setTaskTypeFilter('all');
    setSearchText('');
  };

  const shiftDate = (direction: number): void => {
    updateSelectedDate((prev) => {
      const next = new Date(prev);
      if (currentView === 'month') next.setMonth(next.getMonth() + direction);
      else if (currentView === 'day') next.setDate(next.getDate() + direction);
      else next.setDate(next.getDate() + direction * 7);
      return next;
    });
  };

  const onViewChange = (nextView: string): void => {
    const typedView = nextView as SchedulerView;
    if (!resolvedViews.includes(typedView)) return;
    applyViewChange(typedView);
  };
  const draggingInlineContent = draggingDurationMinutes <= SLOT_MINUTES;
  const draggingShowIssueKey = draggingDurationMinutes >= 30;
  const draggingDescriptionPreview = previewDescription(draggingEntry?.description);
  const draggingShowDescription = draggingDurationMinutes >= 60 && Boolean(draggingDescriptionPreview);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className={`tempo-shell theme-${theme}`} style={schedulerCssVars}>
      <header className="tempo-top">
        <div>
          <h1 className="tempo-title">{title}</h1>
          <p className="tempo-sub">
            {ui?.subtitle ?? `Week ${fmtWeek(selectedDate)} | dnd-kit scheduler + drag & drop`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {showThemeToggle && (
            <button type="button" className="btn" onClick={toggleTheme}>
              {theme === 'light' ? 'Dark theme' : 'Light theme'}
            </button>
          )}
          {showSubmitButton && (
            <button type="button" className="btn primary" onClick={onSubmitWeek}>
              {submitButtonLabel}
            </button>
          )}
        </div>
      </header>

      <main className="tempo-main">
        {showKpis && (
          <section className="kpis">
            <div className="card kpi">
              <div className="l">Today</div>
              <div className="v">{todayHours.toFixed(1)}h</div>
              <div className="small">{fmtDate(today)}</div>
            </div>
            <div className="card kpi">
              <div className="l">This week</div>
              <div className="v">{weekHours.toFixed(1)}h</div>
              <div className="small">{fmtWeek(selectedDate)}</div>
            </div>
            <div className="card kpi">
              <div className="l">Billable</div>
              <div className="v">{billableHours.toFixed(1)}h</div>
              <div className="small">
                {weekHours ? Math.round((billableHours / weekHours) * 100) : 0}% ratio | {utilization}% utilization
              </div>
            </div>
          </section>
        )}

        {showWeekStrip && (
          <section className="card">
            <div className="card-h">Week strip</div>
            <div className="day-strip">
              {weekDays.map((entry) => (
                <div key={entry.day.toISOString()} className={`strip-day ${sameDay(entry.day, today) ? 'today' : ''}`}>
                  <div className="strip-title">{fmtDay(entry.day)}</div>
                  <div className="strip-hours">{entry.hours.toFixed(1)}h</div>
                  <div className="small">{fmtDate(entry.day)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {showFilters && (
          <section className="card">
            <div className="card-h">Filters and controls</div>
            <div className="toolbar">
              <select className="select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                <option value="all">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.text}
                  </option>
                ))}
              </select>
              <select className="select" value={taskTypeFilter} onChange={(e) => setTaskTypeFilter(e.target.value)}>
                <option value="all">All task types</option>
                {taskTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.text}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={searchPlaceholder}
              />
              <select className="select" value={currentView} onChange={(e) => onViewChange(e.target.value)}>
                {resolvedViews.map((view) => (
                  <option key={view} value={view}>
                    {VIEW_LABELS[view]}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="date"
                value={toInputDate(selectedDate)}
                onChange={(e) => updateSelectedDate(fromInputDate(e.target.value))}
              />
              <button type="button" className="btn" onClick={() => shiftDate(-1)}>
                Prev
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" onClick={() => updateSelectedDate(startOfDay(new Date()))}>
                  Today
                </button>
                <button type="button" className="btn" onClick={() => shiftDate(1)}>
                  Next
                </button>
                <button type="button" className="btn" onClick={clearFilters} disabled={!activeFilters}>
                  Clear
                </button>
              </div>
            </div>
            <div className="meta">
              {activeFilters ? `${activeFilters} active filters` : 'No filters'} | Drag cards to reschedule, drag
              top/bottom edge to resize, click a slot for {DEFAULT_TASK_MINUTES}m or drag slots to create custom
              duration
            </div>
          </section>
        )}

        <section className="card scheduler-panel">
          <div className="card-h">Scheduler</div>
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={onDndDragStart}
            onDragMove={onDndDragMove}
            onDragCancel={onDndDragCancel}
            onDragEnd={onDndDragEnd}
          >
            <div ref={schedulerWrapRef} className={`scheduler-wrap${scrollbarHot ? ' scrollbar-hot' : ''}`}>
              {currentView !== 'month' && (
                <div className="scheduler" style={{ '--days': viewDays.length } as DayCountStyle}>
                  <div className="sched-head">
                    <div className="sched-head-cell sched-head-spacer" />
                    {viewDays.map((day) => {
                      return (
                        <div key={`head-${day.toISOString()}`} className="sched-head-cell">
                          <div className="sched-label">{fmtDay(day).toUpperCase()}</div>
                          <div className="sched-date">{day.getDate()}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="sched-body">
                    <div className="sched-time">
                      {slotIndexes.map((slot) => {
                        const exactHour = slot % SLOTS_PER_HOUR === 0;
                        return (
                          <div key={`time-${slot}`} className={`sched-time-slot ${exactHour ? 'hour' : 'quarter'}`} />
                        );
                      })}
                      <div className="sched-time-labels">
                        {timeLabelSlots.map((slot) => (
                          <span
                            key={`time-label-${slot}`}
                            className={`sched-time-axis-label ${slot === 0 ? 'first' : ''}`}
                            style={{ top: slot * SLOT_HEIGHT }}
                          >
                            {fmtHour(slot, START_MINUTES, SLOT_MINUTES)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {viewDays.map((day) => {
                      const dayEntries = entriesForDay(day).map((entry) => {
                        if (resizeDraft?.id !== entry.id) return entry;
                        const minutes = Math.max(
                          SLOT_MINUTES,
                          Math.round(
                            (new Date(resizeDraft.endDate).getTime() - new Date(resizeDraft.startDate).getTime()) /
                              60000,
                          ),
                        );
                        return {
                          ...entry,
                          startDate: resizeDraft.startDate,
                          endDate: resizeDraft.endDate,
                          timeSpent: Math.round((minutes / 60) * 100) / 100,
                        };
                      });
                      const dayId = dayKey(day);
                      const previewActive =
                        canDrag && dragPreview?.mode === 'grid' && dragPreview.day === dayId && draggingId !== null;
                      const previewStart = previewActive
                        ? dayWithMinutes(day, START_MINUTES + dragPreview.slot * SLOT_MINUTES)
                        : null;
                      const hoverActive =
                        canCreate &&
                        !draggingId &&
                        !resizeDraft &&
                        !createDraft &&
                        hoverSlot?.day === dayId &&
                        Number.isInteger(hoverSlot?.slot);
                      const hoverStart = hoverActive
                        ? dayWithMinutes(day, START_MINUTES + hoverSlot.slot * SLOT_MINUTES)
                        : null;
                      const createActive = canCreate && createDraft?.day === dayId;
                      const createStartSlot = createActive ? Math.min(createDraft.startSlot, createDraft.endSlot) : 0;
                      const createSlotCount = createActive
                        ? Math.max(1, Math.abs(createDraft.endSlot - createDraft.startSlot) + 1)
                        : 0;
                      const createStart = createActive
                        ? dayWithMinutes(day, START_MINUTES + createStartSlot * SLOT_MINUTES)
                        : null;

                      return (
                        <div
                          key={`day-${day.toISOString()}`}
                          ref={(node) => {
                            if (node) gridDayRefs.current.set(dayId, node);
                            else gridDayRefs.current.delete(dayId);
                          }}
                          className={`sched-day ${sameDay(day, today) ? 'today' : ''}`}
                          onMouseMove={(event) => onDayMouseMove(day, event)}
                          onMouseLeave={onDayMouseLeave}
                          onMouseDown={(event) => startCreateSelection(day, event)}
                        >
                          {slotIndexes.map((slot) => {
                            const exactHour = slot % SLOTS_PER_HOUR === 0;
                            return (
                              <div
                                key={`line-${day.toISOString()}-${slot}`}
                                className={`sched-line ${exactHour ? 'hour' : 'quarter'}`}
                              />
                            );
                          })}
                          {previewActive && (
                            <div
                              className="sched-preview"
                              style={{ top: dragPreview.slot * SLOT_HEIGHT, height: dragSlots * SLOT_HEIGHT }}
                            >
                              <div className="sched-preview-top">
                                <span className="sched-preview-line" />
                                <span className="sched-preview-chip">
                                  <span>{fmtTime(previewStart)}</span>
                                  <span className="sched-preview-plus">+</span>
                                </span>
                                <span className="sched-preview-line" />
                              </div>
                            </div>
                          )}
                          {hoverActive && (
                            <div
                              className="sched-preview sched-hover"
                              style={{ top: hoverSlot.slot * SLOT_HEIGHT, height: 0 }}
                            >
                              <div className="sched-preview-top">
                                <span className="sched-preview-line" />
                                <span className="sched-preview-chip">
                                  <span>{fmtTime(hoverStart)}</span>
                                  <span className="sched-preview-plus">+</span>
                                </span>
                                <span className="sched-preview-line" />
                              </div>
                            </div>
                          )}
                          {createActive && (
                            <div
                              className="sched-preview sched-select"
                              style={{ top: createStartSlot * SLOT_HEIGHT, height: createSlotCount * SLOT_HEIGHT }}
                            >
                              <div className="sched-preview-top">
                                <span className="sched-preview-line" />
                                <span className="sched-preview-chip">
                                  <span>{fmtTime(createStart)}</span>
                                  <span className="sched-preview-plus">+</span>
                                </span>
                                <span className="sched-preview-line" />
                              </div>
                            </div>
                          )}
                          {dayEntries.map((entry) => {
                            const entryDurationMinutes = durationMinutes(entry, SLOT_MINUTES);
                            const densityClass = densityClassForMinutes(entryDurationMinutes);
                            const isShortEntry = entryDurationMinutes <= 45;
                            const inlineContent = entryDurationMinutes <= SLOT_MINUTES;
                            const showIssueKey = entryDurationMinutes >= 30;
                            const descriptionPreview = previewDescription(entry.description);
                            const showDescription = entryDurationMinutes >= 60 && Boolean(descriptionPreview);
                            const issueKey = issueKeyForEntry(entry);
                            const startMins = clamp(
                              minutesOfDay(new Date(entry.startDate)) - START_MINUTES,
                              0,
                              SLOT_COUNT * SLOT_MINUTES - SLOT_MINUTES,
                            );
                            const top = (startMins / SLOT_MINUTES) * SLOT_HEIGHT;
                            const height = Math.max(20, (entryDurationMinutes / SLOT_MINUTES) * SLOT_HEIGHT - 2);
                            const width = 'calc(100% - 6px)';
                            const left = '3px';
                            const isHovered = hoveredEntryId === entry.id;

                            return (
                              <DraggableCard
                                key={entry.id}
                                id={entry.id}
                                disabled={Boolean(resizeDraft) || !canDrag}
                                className={`entry${densityClass ? ` ${densityClass}` : ''}${entry.completed ? ' completed' : ''}${settleEntryId === entry.id ? ' settle' : ''}${resizeDraft?.id === entry.id ? ' resizing' : ''}${isHovered ? ' hovered' : ''}`}
                                title={entry.description || ''}
                                style={{ top, height, left, width }}
                                onMouseEnter={() => onEntryMouseEnter(entry.id)}
                                onMouseLeave={() => onEntryMouseLeave(entry.id)}
                              >
                                {canResize && (
                                  <button
                                    type="button"
                                    className="entry-resize-handle top"
                                    tabIndex={-1}
                                    aria-label={`Resize start of ${entry.text}`}
                                    onPointerDown={(event) => startResize(entry, 'top', event)}
                                  />
                                )}
                                {(canDelete || canEdit || canComplete) && (
                                  <EntryActionMenu
                                    className={`entry-menu ${isShortEntry ? 'entry-menu-above' : 'entry-menu-inside'}`}
                                    completed={Boolean(entry.completed)}
                                    canDelete={canDelete}
                                    canEdit={canEdit}
                                    canToggleComplete={canComplete}
                                    onEdit={() => editAppointment(entry.id)}
                                    onDelete={() => deleteAppointment(entry.id)}
                                    onToggleComplete={() => toggleComplete(entry.id)}
                                  />
                                )}
                                {inlineContent ? (
                                  <div className="entry-content entry-content-inline">
                                    <div className="entry-inline-head">
                                      <span className="entry-inline-icon" aria-hidden="true">
                                        <svg viewBox="0 0 16 16">
                                          <path d="M4.1 3.3L8.7 8l-4.6 4.7 1.5 1.4L11.7 8 5.6 1.9z" />
                                          <path d="M8.3 3.3L12.9 8l-4.6 4.7 1.5 1.4L16 8 9.8 1.9z" />
                                        </svg>
                                      </span>
                                      <div className="entry-title">{entry.text}</div>
                                    </div>
                                    <div className="entry-duration">{fmtDurationCompact(entryDurationMinutes)}</div>
                                  </div>
                                ) : (
                                  <div className="entry-content">
                                    <div className="entry-head">
                                      <div className="entry-title">{entry.text}</div>
                                      {showDescription && (
                                        <div className="entry-desc" title={descriptionPreview}>
                                          {descriptionPreview}
                                        </div>
                                      )}
                                    </div>
                                    <div className={`entry-footer${showIssueKey ? '' : ' only-duration'}`}>
                                      {showIssueKey && (
                                        <div className="entry-key" title={issueKey}>
                                          <span className="entry-key-icon" aria-hidden="true">
                                            <svg viewBox="0 0 16 16">
                                              <path d="M4.1 3.3L8.7 8l-4.6 4.7 1.5 1.4L11.7 8 5.6 1.9z" />
                                              <path d="M8.3 3.3L12.9 8l-4.6 4.7 1.5 1.4L16 8 9.8 1.9z" />
                                            </svg>
                                          </span>
                                          <span className="entry-key-label">{issueKey}</span>
                                        </div>
                                      )}
                                      <div className="entry-duration">{fmtDurationCompact(entryDurationMinutes)}</div>
                                    </div>
                                  </div>
                                )}
                                {canResize && (
                                  <button
                                    type="button"
                                    className="entry-resize-handle bottom"
                                    tabIndex={-1}
                                    aria-label={`Resize end of ${entry.text}`}
                                    onPointerDown={(event) => startResize(entry, 'bottom', event)}
                                  />
                                )}
                              </DraggableCard>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentView === 'month' && (
                <div className="month">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <div key={d} className="mh">
                      {d}
                    </div>
                  ))}
                  {month.map((cell) => {
                    const dayEntries = entriesForDay(cell.day);
                    const cellId = dayKey(cell.day);
                    const isDrop =
                      canDrag && dragPreview?.mode === 'month' && dragPreview.day === cellId && draggingId !== null;
                    return (
                      <div
                        key={cell.day.toISOString()}
                        ref={(node) => {
                          if (node) monthDayRefs.current.set(cellId, node);
                          else monthDayRefs.current.delete(cellId);
                        }}
                        className={`mc ${!cell.inMonth ? 'muted' : ''} ${sameDay(cell.day, today) ? 'today' : ''} ${isDrop ? 'drop' : ''}`}
                      >
                        <div className="md">{cell.day.getDate()}</div>
                        <div className="mt">
                          {dayEntries.reduce((sum, entry) => sum + (entry.timeSpent || 0), 0).toFixed(1)}h
                        </div>
                        {dayEntries.slice(0, 3).map((entry) => {
                          const project = projects.find((p) => p.id === entry.projectId);
                          const isHovered = hoveredEntryId === entry.id;
                          return (
                            <DraggableCard
                              key={entry.id}
                              id={entry.id}
                              disabled={Boolean(resizeDraft) || !canDrag}
                              className={`month-entry${entry.completed ? ' completed' : ''}${settleEntryId === entry.id ? ' settle' : ''}${isHovered ? ' hovered' : ''}`}
                              style={{ borderLeftColor: project?.color || '#0052cc' }}
                              title={`${entry.text} | ${fmtTime(new Date(entry.startDate))}`}
                              onMouseEnter={() => onEntryMouseEnter(entry.id)}
                              onMouseLeave={() => onEntryMouseLeave(entry.id)}
                            >
                              {(canDelete || canEdit || canComplete) && (
                                <EntryActionMenu
                                  className="month-entry-menu month-entry-menu-inside"
                                  completed={Boolean(entry.completed)}
                                  canDelete={canDelete}
                                  canEdit={canEdit}
                                  canToggleComplete={canComplete}
                                  onEdit={() => editAppointment(entry.id)}
                                  onDelete={() => deleteAppointment(entry.id)}
                                  onToggleComplete={() => toggleComplete(entry.id)}
                                />
                              )}
                              {entry.text}
                            </DraggableCard>
                          );
                        })}
                        {dayEntries.length > 3 && <div className="month-more">+{dayEntries.length - 3} more</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {canDrag && draggingEntry && dragPointer && (
              <div
                className="drag-overlay"
                style={{
                  left: dragPointer.x - dragAnchorPxRef.current.x + DRAG_OVERLAY_NUDGE_X,
                  top: dragPointer.y - dragAnchorPxRef.current.y + DRAG_OVERLAY_NUDGE_Y,
                  width: dragOverlayWidth || undefined,
                  height: dragOverlayHeight || undefined,
                }}
              >
                <div
                  className={`drag-overlay-card${draggingDensityClass ? ` ${draggingDensityClass}` : ''}${draggingEntry.completed ? ' completed' : ''}`}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                >
                  {draggingInlineContent ? (
                    <div className="entry-content entry-content-inline">
                      <div className="entry-inline-head">
                        <span className="entry-inline-icon" aria-hidden="true">
                          <svg viewBox="0 0 16 16">
                            <path d="M4.1 3.3L8.7 8l-4.6 4.7 1.5 1.4L11.7 8 5.6 1.9z" />
                            <path d="M8.3 3.3L12.9 8l-4.6 4.7 1.5 1.4L16 8 9.8 1.9z" />
                          </svg>
                        </span>
                        <div className="entry-title">{draggingEntry.text}</div>
                      </div>
                      <div className="entry-duration">{fmtDurationCompact(draggingDurationMinutes)}</div>
                    </div>
                  ) : (
                    <div className="entry-content">
                      <div className="entry-head">
                        <div className="entry-title">{draggingEntry.text}</div>
                        {draggingShowDescription && (
                          <div className="entry-desc" title={draggingDescriptionPreview}>
                            {draggingDescriptionPreview}
                          </div>
                        )}
                      </div>
                      <div className={`entry-footer${draggingShowIssueKey ? '' : ' only-duration'}`}>
                        {draggingShowIssueKey && (
                          <div className="entry-key" title={issueKeyForEntry(draggingEntry)}>
                            <span className="entry-key-icon" aria-hidden="true">
                              <svg viewBox="0 0 16 16">
                                <path d="M4.1 3.3L8.7 8l-4.6 4.7 1.5 1.4L11.7 8 5.6 1.9z" />
                                <path d="M8.3 3.3L12.9 8l-4.6 4.7 1.5 1.4L16 8 9.8 1.9z" />
                              </svg>
                            </span>
                            <span className="entry-key-label">{issueKeyForEntry(draggingEntry)}</span>
                          </div>
                        )}
                        <div className="entry-duration">{fmtDurationCompact(draggingDurationMinutes)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DndContext>
        </section>
      </main>
    </div>
  );
};

const Scheduler = Object.assign(SchedulerBase, { TaskItem: SchedulerTaskItem });

export default Scheduler;
