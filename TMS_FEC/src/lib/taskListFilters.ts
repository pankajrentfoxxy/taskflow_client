import type { ReportsDateFilterMode, TaskDueDateFilterMode } from '@/lib/util';

export type TasksPageFilters = {
  filter: string;
  status: string;
  q: string;
  filterAssignee: string;
  dueDateMode: TaskDueDateFilterMode;
  dueFromDate: string;
  dueToDate: string;
  page: number;
};

export type HomePageFilters = {
  filterAssignee: string;
  dueDateMode: TaskDueDateFilterMode;
  dueFromDate: string;
  dueToDate: string;
};

export type ReportsPageFilters = {
  dateMode: ReportsDateFilterMode;
  fromDate: string;
  toDate: string;
  teamId: string;
  typeId: string;
  showOverall: boolean;
};

const TASKS_KEY = 'tf-tasks-filters';
const HOME_KEY = 'tf-home-filters';
const REPORTS_KEY = 'tf-reports-filters';

export const DEFAULT_TASKS_PAGE_FILTERS: TasksPageFilters = {
  filter: 'mine',
  status: '',
  q: '',
  filterAssignee: '',
  dueDateMode: 'all',
  dueFromDate: '',
  dueToDate: '',
  page: 1,
};

export const DEFAULT_HOME_PAGE_FILTERS: HomePageFilters = {
  filterAssignee: '',
  dueDateMode: 'all',
  dueFromDate: '',
  dueToDate: '',
};

export const DEFAULT_REPORTS_PAGE_FILTERS: ReportsPageFilters = {
  dateMode: 'all',
  fromDate: '',
  toDate: '',
  teamId: '',
  typeId: '',
  showOverall: true,
};

function readStored<T>(key: string, defaults: T): T {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function writeStored(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadTasksPageFilters(): TasksPageFilters {
  const stored = readStored(TASKS_KEY, DEFAULT_TASKS_PAGE_FILTERS);
  return {
    ...stored,
    page: Math.max(1, Number(stored.page) || 1),
    dueDateMode: stored.dueDateMode === 'today' || stored.dueDateMode === 'range' ? stored.dueDateMode : 'all',
  };
}

export function saveTasksPageFilters(filters: TasksPageFilters) {
  writeStored(TASKS_KEY, filters);
}

export function clearTasksPageFilters() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TASKS_KEY);
}

export function loadHomePageFilters(): HomePageFilters {
  const stored = readStored(HOME_KEY, DEFAULT_HOME_PAGE_FILTERS);
  return {
    ...stored,
    dueDateMode: stored.dueDateMode === 'today' || stored.dueDateMode === 'range' ? stored.dueDateMode : 'all',
  };
}

export function saveHomePageFilters(filters: HomePageFilters) {
  writeStored(HOME_KEY, filters);
}

export function clearHomePageFilters() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(HOME_KEY);
}

const REPORTS_DATE_MODES: ReportsDateFilterMode[] = ['all', 'today', '7', '30', '90', 'range'];

export function loadReportsPageFilters(): ReportsPageFilters {
  const stored = readStored(REPORTS_KEY, DEFAULT_REPORTS_PAGE_FILTERS);
  return {
    ...stored,
    dateMode: REPORTS_DATE_MODES.includes(stored.dateMode as ReportsDateFilterMode)
      ? stored.dateMode
      : 'all',
    showOverall: stored.showOverall !== false,
  };
}

export function saveReportsPageFilters(filters: ReportsPageFilters) {
  writeStored(REPORTS_KEY, filters);
}

export function clearReportsPageFilters() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(REPORTS_KEY);
}
