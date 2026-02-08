import type { Appointment, Project, TaskType } from './types';

export const projects: Project[] = [
  { id: 1, text: 'Project Alpha', color: '#0052cc' },
  { id: 2, text: 'Project Beta', color: '#0c66e4' },
  { id: 3, text: 'Project Gamma', color: '#1f845a' },
  { id: 4, text: 'Internal Tasks', color: '#a54800' },
];

export const taskTypes: TaskType[] = [
  { id: 'development', text: 'Development', billable: true },
  { id: 'meeting', text: 'Meeting', billable: false },
  { id: 'review', text: 'Code Review', billable: true },
  { id: 'bugfix', text: 'Bug Fix', billable: true },
  { id: 'documentation', text: 'Documentation', billable: true },
  { id: 'testing', text: 'Testing', billable: true },
];

export const initialAppointments: Appointment[] = [
  {
    id: 1,
    text: 'Design Review',
    startDate: new Date(2026, 1, 9, 9, 30),
    endDate: new Date(2026, 1, 9, 11, 30),
    projectId: 1,
    taskType: 'meeting',
    description: 'Review design mockups',
    timeSpent: 2,
  },
  {
    id: 2,
    text: 'Backend Development',
    startDate: new Date(2026, 1, 9, 9, 30),
    endDate: new Date(2026, 1, 9, 13, 30),
    projectId: 2,
    taskType: 'development',
    description: 'Implement REST API',
    timeSpent: 4,
  },
  {
    id: 3,
    text: 'Code Review',
    startDate: new Date(2026, 1, 10, 9, 30),
    endDate: new Date(2026, 1, 10, 11, 0),
    projectId: 2,
    taskType: 'review',
    description: 'Review pull requests',
    timeSpent: 1.5,
  },
  {
    id: 4,
    text: 'Sprint Planning',
    startDate: new Date(2026, 1, 10, 9, 30),
    endDate: new Date(2026, 1, 10, 11, 30),
    projectId: 1,
    taskType: 'meeting',
    description: 'Plan sprint',
    timeSpent: 2,
  },
  {
    id: 5,
    text: 'Bug Fixes',
    startDate: new Date(2026, 1, 11, 9, 30),
    endDate: new Date(2026, 1, 11, 12, 30),
    projectId: 3,
    taskType: 'bugfix',
    description: 'Fix production bugs',
    timeSpent: 3,
  },
];
