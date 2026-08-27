import ExcelJS from 'exceljs';

type UserRow = {
  id: number;
  name: string;
  email: string;
  team_id?: number | null;
  team_name?: string | null;
};
type TeamRow = { id: number; name: string };
type ProjectRow = { id: number; name: string; owner_id?: number };
type TaskTypeRow = { id: number; name: string; team_id: number; team_name?: string | null };

export type TaskTemplateData = {
  users: UserRow[];
  teams: TeamRow[];
  projects: ProjectRow[];
  taskTypes: TaskTypeRow[];
  userProjects: Record<number, string[]>;
  teamProjects: Record<number, string[]>;
};

const PRIORITIES = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];
const DUE_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
const DUE_DATE_COUNT = 365;
const TASK_ROW_COUNT = 200;
const NO_TEAM_ID = 0;
const OPTIONAL_TYPE = '(optional)';

type AssigneeEntry = {
  label: string;
  teamId: number;
  taskTypesRange: string;
  projectRange: string;
};

function colLetter(n: number): string {
  let s = '';
  let x = n;
  while (x >= 0) {
    s = String.fromCharCode((x % 26) + 65) + s;
    x = Math.floor(x / 26) - 1;
  }
  return s;
}

function cellRef(col: number, row: number): string {
  return `$${colLetter(col)}$${row}`;
}

function rangeRef(col: number, startRow: number, endRow: number): string {
  return `Lists!${cellRef(col, startRow)}:${cellRef(col, endRow)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function buildDueDateList(): string[] {
  const dates: string[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < DUE_DATE_COUNT; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(formatDateOnly(d));
  }
  return dates;
}

function buildAssigneeEntries(users: UserRow[], teams: TeamRow[]): AssigneeEntry[] {
  const entries: AssigneeEntry[] = users.map((u) => ({
    label: `${u.name}${u.team_name ? ` (${u.team_name})` : ''}`,
    teamId: u.team_id ?? NO_TEAM_ID,
    taskTypesRange: `TeamTypes_${u.team_id ?? NO_TEAM_ID}`,
    projectRange: `UserProjects_${u.id}`,
  }));
  for (const t of teams) {
    entries.push({
      label: `Team: ${t.name}`,
      teamId: t.id,
      taskTypesRange: `TeamTypes_${t.id}`,
      projectRange: `TeamProjects_${t.id}`,
    });
  }
  return entries;
}

function writeGrid(ws: ExcelJS.Worksheet, grid: string[][]) {
  for (let r = 0; r < grid.length; r++) {
    const row = ws.getRow(r + 1);
    for (let c = 0; c < grid[r].length; c++) {
      const value = grid[r][c];
      if (value !== undefined && value !== '') row.getCell(c + 1).value = value;
    }
  }
}

function addColumnListValidation(
  ws: ExcelJS.Worksheet,
  col: string,
  formula: string,
  prompt?: { title: string; text: string }
) {
  ws.dataValidations.add(`${col}2:${col}${TASK_ROW_COUNT + 1}`, {
    type: 'list',
    allowBlank: true,
    showInputMessage: true,
    showErrorMessage: true,
    formulae: [formula],
    ...(prompt ? { promptTitle: prompt.title, prompt: prompt.text } : {}),
  });
}

function fillDependentHelperFormulas(ws: ExcelJS.Worksheet) {
  for (let row = 2; row <= TASK_ROW_COUNT + 1; row++) {
    ws.getCell(`J${row}`).value = {
      formula: `IFERROR(VLOOKUP(B${row},AssigneeLookup,3,FALSE),"")`,
    };
    ws.getCell(`K${row}`).value = {
      formula: `IFERROR(VLOOKUP(B${row},AssigneeLookup,4,FALSE),"")`,
    };
  }
  ws.getColumn(10).hidden = true;
  ws.getColumn(11).hidden = true;
}

function buildListsSheet(wb: ExcelJS.Workbook, data: TaskTemplateData, assignees: AssigneeEntry[]) {
  const ws = wb.addWorksheet('Lists', { state: 'hidden' });
  const assigneeEnd = assignees.length + 1;
  const grid: string[][] = [];

  const set = (row: number, col: number, value: string) => {
    while (grid.length <= row) grid.push([]);
    grid[row][col] = value;
  };

  set(0, 0, 'Assignees');
  assignees.forEach((a, i) => set(i + 1, 0, a.label));

  set(0, 1, 'Priority');
  PRIORITIES.forEach((p, i) => set(i + 1, 1, p));

  set(0, 2, 'Due time');
  DUE_TIMES.forEach((t, i) => set(i + 1, 2, t));

  const dueDates = buildDueDateList();
  set(0, 3, 'Due date');
  dueDates.forEach((d, i) => set(i + 1, 3, d));

  set(0, 4, 'Assignee label');
  set(0, 5, 'Team id');
  set(0, 6, 'Task types range');
  set(0, 7, 'Project range');
  assignees.forEach((a, i) => {
    set(i + 1, 4, a.label);
    set(i + 1, 5, String(a.teamId));
    set(i + 1, 6, a.taskTypesRange);
    set(i + 1, 7, a.projectRange);
  });

  const typesByTeam = new Map<number, string[]>();
  for (const tt of data.taskTypes) {
    const list = typesByTeam.get(tt.team_id) ?? [];
    list.push(tt.name);
    typesByTeam.set(tt.team_id, list);
  }
  for (const t of data.teams) {
    if (!typesByTeam.has(t.id)) typesByTeam.set(t.id, []);
  }
  for (const u of data.users) {
    const tid = u.team_id ?? NO_TEAM_ID;
    if (!typesByTeam.has(tid)) typesByTeam.set(tid, []);
  }
  if (!typesByTeam.has(NO_TEAM_ID)) typesByTeam.set(NO_TEAM_ID, []);

  wb.definedNames.add(rangeRef(0, 2, assigneeEnd), 'Assignees');
  wb.definedNames.add(rangeRef(1, 2, PRIORITIES.length + 1), 'Priorities');
  wb.definedNames.add(rangeRef(2, 2, DUE_TIMES.length + 1), 'DueTimes');
  wb.definedNames.add(rangeRef(3, 2, dueDates.length + 1), 'DueDates');
  wb.definedNames.add(`Lists!$E$2:$H$${assigneeEnd}`, 'AssigneeLookup');

  let col = 8;
  for (const [teamId, names] of [...typesByTeam.entries()].sort((a, b) => a[0] - b[0])) {
    const unique = [...new Set(names.filter(Boolean))];
    const values = unique.length ? unique : [OPTIONAL_TYPE];
    set(0, col, `TeamTypes_${teamId}`);
    values.forEach((name, i) => set(i + 1, col, name));
    wb.definedNames.add(rangeRef(col, 2, values.length + 1), `TeamTypes_${teamId}`);
    col += 1;
  }

  for (const u of data.users) {
    const rangeName = `UserProjects_${u.id}`;
    const projects = ['None', ...(data.userProjects[u.id] ?? [])];
    set(0, col, rangeName);
    projects.forEach((name, i) => set(i + 1, col, name));
    wb.definedNames.add(rangeRef(col, 2, projects.length + 1), rangeName);
    col += 1;
  }

  for (const t of data.teams) {
    const rangeName = `TeamProjects_${t.id}`;
    const projects = ['None', ...(data.teamProjects[t.id] ?? [])];
    set(0, col, rangeName);
    projects.forEach((name, i) => set(i + 1, col, name));
    wb.definedNames.add(rangeRef(col, 2, projects.length + 1), rangeName);
    col += 1;
  }

  writeGrid(ws, grid);
  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 36;
  ws.getColumn(6).width = 10;
  ws.getColumn(7).width = 18;
  ws.getColumn(8).width = 18;
}

export async function buildTaskTemplateWorkbook(data: TaskTemplateData): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TaskFlow';
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 12000, height: 24000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

  const assignees = buildAssigneeEntries(data.users, data.teams);
  const tasks = wb.addWorksheet('Tasks');

  const headers = [
    'Title*',
    'Assign to*',
    'Task type',
    'Due date*',
    'Due time*',
    'Priority',
    'Project',
    'Description',
  ];

  const exampleDueDate = buildDueDateList()[1];

  const first = assignees[0];
  const firstTeamId = first?.teamId ?? NO_TEAM_ID;
  const exampleType =
    data.taskTypes.find((t) => t.team_id === firstTeamId)?.name ?? OPTIONAL_TYPE;
  const exampleProject =
    first?.projectRange.startsWith('UserProjects_')
      ? (data.userProjects[Number(first.projectRange.replace('UserProjects_', ''))]?.[0] ?? 'None')
      : first?.projectRange.startsWith('TeamProjects_')
        ? (data.teamProjects[Number(first.projectRange.replace('TeamProjects_', ''))]?.[0] ?? 'None')
        : 'None';

  tasks.addRow(headers);
  tasks.addRow([
    'Follow up corporate lead',
    first?.label ?? '',
    exampleType,
    exampleDueDate,
    '17:00',
    'NORMAL',
    exampleProject || 'None',
    'Optional notes for the assignee',
  ]);

  const widths = [32, 28, 24, 14, 10, 10, 24, 36];
  widths.forEach((w, i) => {
    tasks.getColumn(i + 1).width = w;
  });

  buildListsSheet(wb, data, assignees);
  fillDependentHelperFormulas(tasks);

  addColumnListValidation(tasks, 'B', 'Assignees');
  addColumnListValidation(tasks, 'C', 'INDIRECT($J2)');
  addColumnListValidation(tasks, 'D', 'DueDates', {
    title: 'Due date',
    text: 'Pick a date from the dropdown list.',
  });
  addColumnListValidation(tasks, 'E', 'DueTimes', {
    title: 'Due time',
    text: 'Pick a time from the dropdown list.',
  });
  addColumnListValidation(tasks, 'F', 'Priorities');
  addColumnListValidation(tasks, 'G', 'INDIRECT($K2)');

  return wb;
}

export async function downloadTaskTemplate(
  data: TaskTemplateData,
  filename = 'taskflow-task-template.xlsx'
) {
  const wb = await buildTaskTemplateWorkbook(data);
  const out = await wb.xlsx.writeBuffer();
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchTaskTemplateData(): Promise<TaskTemplateData> {
  const { api } = await import('./util');
  const res = await api('/api/tasks/template-data');
  return {
    users: res.users ?? [],
    teams: res.teams ?? [],
    projects: res.projects ?? [],
    taskTypes: (res.taskTypes ?? []).map((t: TaskTypeRow) => ({
      id: t.id,
      name: t.name,
      team_id: t.team_id,
      team_name: t.team_name,
    })),
    userProjects: res.userProjects ?? {},
    teamProjects: res.teamProjects ?? {},
  };
}
