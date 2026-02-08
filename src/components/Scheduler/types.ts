import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';
export type SchedulerView = 'day' | 'week' | 'workWeek' | 'month';
export type ResizeEdge = 'top' | 'bottom';
export type SchedulerBlockMinutes = 15 | 30 | 60;

export interface SchedulerConfig {
  views?: SchedulerView[];
  startTime?: Date;
  endTime?: Date;
  blockMinutes?: SchedulerBlockMinutes;
}

export interface SchedulerUiConfig {
  title?: string;
  subtitle?: string;
  searchPlaceholder?: string;
  submitButtonLabel?: string;
  showThemeToggle?: boolean;
  showSubmitButton?: boolean;
  showKpis?: boolean;
  showWeekStrip?: boolean;
  showFilters?: boolean;
}

export interface SchedulerFeaturesConfig {
  drag?: boolean;
  resize?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  complete?: boolean;
}

export type SchedulerCssVarStyle = CSSProperties & {
  '--slot-height': number;
  '--slot-count': number;
  '--settle-ms': string;
};

export type DayCountStyle = CSSProperties & {
  '--days': number;
};

export interface Project {
  id: number;
  text: string;
  color: string;
}

export interface TaskType {
  id: string;
  text: string;
  billable: boolean;
}

export interface Appointment {
  id: number;
  text: string;
  startDate: Date;
  endDate: Date;
  projectId: number;
  taskType: string;
  description: string;
  timeSpent: number;
  issueKey?: string;
  completed?: boolean;
}

export interface SchedulerTaskItemProps {
  id: number;
  text: string;
  startDate: Date | number | string;
  endDate: Date | number | string;
  projectId: number;
  taskType: string;
  description?: string;
  timeSpent?: number;
  issueKey?: string;
  completed?: boolean;
}

export interface SchedulerProps {
  children?: ReactNode;
  projects?: Project[];
  taskTypes?: TaskType[];
  initialView?: SchedulerView;
  initialDate?: Date;
  initialTheme?: ThemeMode;
  config?: SchedulerConfig;
  ui?: SchedulerUiConfig;
  features?: SchedulerFeaturesConfig;
  readOnly?: boolean;
  onSubmitWeek?: () => void;
  onViewChange?: (view: SchedulerView) => void;
  onDateChange?: (date: Date) => void;
  onTaskCreate?: (
    draft: Omit<Appointment, 'id'>,
    context: { day: Date; slot: number; durationMinutes: number },
  ) => void;
  onTaskDelete?: (task: Appointment) => void;
  onTaskEdit?: (task: Appointment) => void;
  onTaskToggleComplete?: (task: Appointment, nextCompleted: boolean) => void;
  onTasksChange?: (tasks: Appointment[]) => void;
}

export interface DragPreviewGrid {
  mode: 'grid';
  day: string;
  slot: number;
}

export interface DragPreviewMonth {
  mode: 'month';
  day: string;
}

export type DragPreview = DragPreviewGrid | DragPreviewMonth;

export interface DragPoint {
  x: number;
  y: number;
}

export interface ResizeDraft {
  id: number;
  startDate: Date;
  endDate: Date;
}

export interface ResizeSession {
  id: number;
  edge: ResizeEdge;
  day: Date;
  pointerStartY: number;
  startMinutes: number;
  endMinutes: number;
}

export interface CreateDraft {
  day: string;
  dayDate: Date;
  startSlot: number;
  endSlot: number;
}

export interface HoverSlot {
  day: string;
  slot: number;
}

export interface PointerListeners {
  move: ((event: PointerEvent) => void) | null;
  up: ((event?: PointerEvent) => void) | null;
}

export interface MouseListeners {
  move: ((event: MouseEvent) => void) | null;
  up: ((event?: MouseEvent) => void) | null;
}

export interface DayLayout {
  laneById: Map<number, number>;
  laneCount: number;
}

export interface HitZone {
  key: string;
  rect: DOMRect;
}

export interface DraggableCardProps {
  id: number;
  className: string;
  style: CSSProperties;
  title?: string;
  children: ReactNode;
  disabled?: boolean;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
}

export interface EntryActionMenuProps {
  className: string;
  completed: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  canToggleComplete?: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggleComplete: () => void;
}
