'use client';
import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Shell, { useMe } from '@/components/Shell';
import TaskTable, { TaskTableSkeleton } from '@/components/TaskTable';
import TaskPagination, { type TaskPaginationMeta } from '@/components/TaskPagination';
import CommentsModal from '@/components/CommentsModal';
import Composer from '@/components/Composer';
import TaskTemplateButton from '@/components/TaskTemplateButton';
import TaskDateRangeFilter from '@/components/TaskDateRangeFilter';
import { api, STATUS_LABEL, taskDueDateQueryParams } from '@/lib/util';
import { onTaskChanged } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import SearchableSelect, { buildUserTeamSelectOptions } from '@/components/SearchableSelect';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  clearTasksPageFilters,
  DEFAULT_TASKS_PAGE_FILTERS,
  loadTasksPageFilters,
  saveTasksPageFilters,
} from '@/lib/taskListFilters';

const PAGE_SIZE = 15;

function TasksInner() {
  const me = useMe();
  const canFilter = me && ['ADMIN', 'CEO'].includes(me.role);
  const params = useSearchParams();
  const [filter, setFilter] = useState(DEFAULT_TASKS_PAGE_FILTERS.filter);
  const [status, setStatus] = useState(DEFAULT_TASKS_PAGE_FILTERS.status);
  const [q, setQ] = useState(DEFAULT_TASKS_PAGE_FILTERS.q);
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [filterAssignee, setFilterAssignee] = useState(DEFAULT_TASKS_PAGE_FILTERS.filterAssignee);
  const [dueDateMode, setDueDateMode] = useState(DEFAULT_TASKS_PAGE_FILTERS.dueDateMode);
  const [dueFromDate, setDueFromDate] = useState(DEFAULT_TASKS_PAGE_FILTERS.dueFromDate);
  const [dueToDate, setDueToDate] = useState(DEFAULT_TASKS_PAGE_FILTERS.dueToDate);
  const [tasks, setTasks] = useState<any[]>([]);
  const [page, setPage] = useState(DEFAULT_TASKS_PAGE_FILTERS.page);
  const [filtersReady, setFiltersReady] = useState(false);
  const [pagination, setPagination] = useState<TaskPaginationMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [composerOpen, setComposerOpen] = useState(params.get('new') === '1');
  const [commentsTask, setCommentsTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const skipPageResetRef = useRef(true);

  useEffect(() => {
    const stored = loadTasksPageFilters();
    setFilter(stored.filter);
    setStatus(stored.status);
    setQ(stored.q);
    setFilterAssignee(stored.filterAssignee);
    setDueDateMode(stored.dueDateMode);
    setDueFromDate(stored.dueFromDate);
    setDueToDate(stored.dueToDate);
    setPage(stored.page);
    skipPageResetRef.current = true;
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!canFilter) return;
    api('/api/users').then((d) => setUsers(d.users.filter((u: any) => u.is_active)));
    api('/api/teams').then((d) => setTeams(d.teams));
  }, [canFilter]);

  useEffect(() => {
    if (!filtersReady) return;
    saveTasksPageFilters({
      filter,
      status,
      q,
      filterAssignee,
      dueDateMode,
      dueFromDate,
      dueToDate,
      page,
    });
  }, [filter, status, q, filterAssignee, dueDateMode, dueFromDate, dueToDate, page, filtersReady]);

  useEffect(() => {
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [filter, status, q, filterAssignee, dueDateMode, dueFromDate, dueToDate]);

  const load = useCallback(() => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (canFilter && filterAssignee) {
      sp.set('filter', 'all');
      const [kind, idStr] = filterAssignee.split(':');
      if (kind === 'u') sp.set('assigneeId', idStr);
      else if (kind === 't') sp.set('teamId', idStr);
    } else {
      sp.set('filter', filter);
    }
    if (status) sp.set('status', status);
    if (q) sp.set('q', q);
    Object.entries(taskDueDateQueryParams(dueDateMode, dueFromDate, dueToDate)).forEach(([k, v]) => {
      sp.set(k, v);
    });
    sp.set('page', String(page));
    sp.set('limit', String(PAGE_SIZE));
    api(`/api/tasks?${sp}`)
      .then((d) => {
        setTasks(d.tasks);
        setPagination(
          d.pagination ?? { page, limit: PAGE_SIZE, total: d.tasks.length, totalPages: 1 }
        );
      })
      .finally(() => setLoading(false));
  }, [filter, status, q, canFilter, filterAssignee, page, dueDateMode, dueFromDate, dueToDate]);
  useEffect(() => {
    if (!filtersReady) return;
    load();
  }, [load, filtersReady]);

  useEffect(() => onTaskChanged(() => load()), [load]);

  const hasActiveFilters =
    filter !== 'mine' ||
    !!status ||
    !!q.trim() ||
    !!filterAssignee ||
    dueDateMode !== 'all' ||
    !!dueFromDate ||
    !!dueToDate;

  const resetFilters = () => {
    setFilter(DEFAULT_TASKS_PAGE_FILTERS.filter);
    setStatus(DEFAULT_TASKS_PAGE_FILTERS.status);
    setQ(DEFAULT_TASKS_PAGE_FILTERS.q);
    setFilterAssignee(DEFAULT_TASKS_PAGE_FILTERS.filterAssignee);
    setDueDateMode(DEFAULT_TASKS_PAGE_FILTERS.dueDateMode);
    setDueFromDate(DEFAULT_TASKS_PAGE_FILTERS.dueFromDate);
    setDueToDate(DEFAULT_TASKS_PAGE_FILTERS.dueToDate);
    setPage(DEFAULT_TASKS_PAGE_FILTERS.page);
    clearTasksPageFilters();
  };

  const segments = [
    { key: 'mine', label: 'My tasks' },
    { key: 'created', label: 'Created by me' },
    ...(me && me.role === 'MANAGER' ? [{ key: 'team', label: 'Team' }] : []),
    ...(me && ['ADMIN', 'CEO'].includes(me.role) ? [{ key: 'all', label: 'All' }] : []),
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Tasks</h1>
        <div className="flex flex-wrap items-center gap-2">
          <TaskTemplateButton size="sm" onImported={load} />
          <Button onClick={() => setComposerOpen(true)}>+ New task</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <div
          className={cn(
            'grid gap-1.5',
            segments.length <= 3 ? 'grid-cols-3' : 'grid-cols-2',
            'md:flex md:w-auto md:flex-wrap'
          )}
        >
          {segments.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={filter === s.key ? 'default' : 'outline'}
              className="h-8 w-full rounded-full px-2 text-xs sm:px-3 sm:text-sm md:w-auto"
              onClick={() => setFilter(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>
        <Input
          className="h-8 w-full md:min-w-[140px] md:flex-1"
          placeholder="Search tasks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <NativeSelect
          className="h-8 w-full md:w-auto md:shrink-0"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Open tasks</option>
          <option value="all">All</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        {canFilter && (
          <>
            <SearchableSelect
              className="h-8 w-full md:min-w-[200px] md:max-w-[280px] md:shrink-0 text-sm"
              value={filterAssignee}
              onChange={setFilterAssignee}
              aria-label="Filter by user or team"
              placeholder="All users / teams"
              searchPlaceholder="Search users or teams…"
              options={buildUserTeamSelectOptions(users, teams, {
                emptyOption: { value: '', label: 'All users / teams' },
              })}
            />
          </>
        )}
      </div>

      <TaskDateRangeFilter
        className="mb-4"
        mode={dueDateMode}
        fromDate={dueFromDate}
        toDate={dueToDate}
        onModeChange={setDueDateMode}
        onFromDateChange={setDueFromDate}
        onToDateChange={setDueToDate}
        showReset={hasActiveFilters}
        onReset={resetFilters}
      />

      {loading ? (
        <TaskTableSkeleton />
      ) : tasks.length === 0 ? (
        <Card className="py-0">
          <CardContent className="p-10 text-center text-muted-foreground">No tasks match.</CardContent>
        </Card>
      ) : (
        <>
          <TaskTable tasks={tasks} onOpenComments={setCommentsTask} onTaskUpdated={load} />
          <TaskPagination
            pagination={pagination}
            loading={loading}
            onPageChange={setPage}
          />
        </>
      )}

      <CommentsModal
        task={commentsTask}
        open={!!commentsTask}
        onClose={() => setCommentsTask(null)}
        onChanged={load}
      />
      <Composer open={composerOpen} onClose={() => setComposerOpen(false)} onCreated={load} />
    </>
  );
}

export default function TasksPage() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <TasksInner />
      </Suspense>
    </Shell>
  );
}
