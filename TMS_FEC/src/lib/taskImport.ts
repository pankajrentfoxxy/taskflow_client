import ExcelJS from 'exceljs';

export type TaskImportRow = {
  title: string;
  assigneeLabel: string;
  taskTypeName: string;
  dueAtLabel: string;
  priority: string;
  projectName: string;
  description: string;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDueDate(d: Date): string {
  return `${formatDateOnly(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function normalizeTime(value: string): string {
  const s = value.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '17:00';
  return `${pad2(Number(m[1]))}:${m[2]}`;
}

function combineDueAt(dateRaw: string, timeRaw: string): string {
  const time = normalizeTime(timeRaw || '17:00');
  if (!dateRaw) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    return `${dateRaw} ${time}`;
  }

  const full = dateRaw.match(/^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}/);
  if (full) return `${full[1]} ${time}`;

  const parsed = new Date(dateRaw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${formatDateOnly(parsed)} ${time}`;
  }

  return dateRaw;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null || v === '') return '';
  if (v instanceof Date) return formatDueDate(v);
  if (typeof v === 'object' && 'text' in v) return String((v as { text: string }).text).trim();
  if (typeof v === 'object' && 'result' in v) {
    const r = (v as { result?: unknown }).result;
    if (r instanceof Date) return formatDueDate(r);
    if (r != null && r !== '') return String(r).trim();
  }
  if (typeof v === 'object' && 'richText' in v) {
    const parts = (v as { richText: { text: string }[] }).richText;
    return parts.map((p) => p.text).join('').trim();
  }
  return String(v).trim();
}

function cellDateText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null || v === '') return '';
  if (v instanceof Date) return formatDateOnly(v);
  if (typeof v === 'object' && 'result' in v && (v as { result?: unknown }).result instanceof Date) {
    return formatDateOnly((v as { result: Date }).result);
  }
  const text = cellText(cell);
  const m = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : text;
}

function isSplitDueTemplate(ws: ExcelJS.Worksheet): boolean {
  const h4 = String(ws.getRow(1).getCell(4).value ?? '').toLowerCase();
  const h5 = String(ws.getRow(1).getCell(5).value ?? '').toLowerCase();
  return h4.includes('due date') && h5.includes('due time');
}

export async function parseTaskImportFile(file: File): Promise<TaskImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.getWorksheet('Tasks') ?? wb.worksheets.find((s) => s.name !== 'Lists');
  if (!ws) throw new Error('No "Tasks" sheet found — use the TaskFlow template file');

  const splitDue = isSplitDueTemplate(ws);
  const rows: TaskImportRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const title = cellText(row.getCell(1));
    if (!title) return;

    const dueAtLabel = splitDue
      ? combineDueAt(cellDateText(row.getCell(4)), cellText(row.getCell(5)))
      : cellText(row.getCell(4));

    rows.push({
      title,
      assigneeLabel: cellText(row.getCell(2)),
      taskTypeName: cellText(row.getCell(3)),
      dueAtLabel,
      priority: cellText(row.getCell(splitDue ? 6 : 5)) || 'NORMAL',
      projectName: cellText(row.getCell(splitDue ? 7 : 6)),
      description: cellText(row.getCell(splitDue ? 8 : 7)),
    });
  });

  if (rows.length === 0) throw new Error('No task rows found — add at least one row with a title');
  if (rows.length > 200) throw new Error('Maximum 200 tasks per import');
  return rows;
}

export type TaskImportResult = {
  created: number;
  ids: number[];
  errors: { row: number; message: string }[];
};

export async function importTaskRows(rows: TaskImportRow[]): Promise<TaskImportResult> {
  const { api } = await import('./util');
  return api('/api/tasks/import', { method: 'POST', body: JSON.stringify({ rows }) });
}
