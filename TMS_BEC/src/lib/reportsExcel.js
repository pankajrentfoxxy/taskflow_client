import ExcelJS from "exceljs";
import { STATUS_LABEL } from "./statusLabels.js";

const STATUS_EXCEL = {
  ASSIGNED: { bg: "FFFFF4E5", fg: "FF9A3412" },
  DISCUSS: { bg: "FFF5F3FF", fg: "FF6D28D9" },
  ACKNOWLEDGED: { bg: "FFECFEFF", fg: "FF0E7490" },
  IN_PROGRESS: { bg: "FFEFF6FF", fg: "FF1D4ED8" },
  WAITING_FOR_INPUT: { bg: "FFECFEFF", fg: "FF0E7490" },
  INPUT_PROVIDED: { bg: "FFF0FDF4", fg: "FF15803D" },
  DONE: { bg: "FFECFDF5", fg: "FF047857" },
  CANCELLED: { bg: "FFF4F4F5", fg: "FF52525B" },
  REJECTED: { bg: "FFFFF1F2", fg: "FFBE123C" },
  ESCALATED: { bg: "FFFEF2F2", fg: "FFB91C1C" },
};

const STATUS_FALLBACK = { bg: "FFF3F4F6", fg: "FF374151" };

const PRIORITY_EXCEL = {
  URGENT: "FFDC2626",
  HIGH: "FFEA580C",
  NORMAL: "FF6B7280",
  LOW: "FF9CA3AF",
};

const BORDER_GRAY = "FFD1D5DB";
const HEADER_BG = "FFF9FAFB";
const HEADER_FG = "FF374151";
const SECTION_BG = "FFEEF2FF";
const SECTION_FG = "FF4338CA";

const THIN_BORDER = {
  top: { style: "thin", color: { argb: BORDER_GRAY } },
  left: { style: "thin", color: { argb: BORDER_GRAY } },
  bottom: { style: "thin", color: { argb: BORDER_GRAY } },
  right: { style: "thin", color: { argb: BORDER_GRAY } },
};

function fmtDateTime(ts) {
  if (ts == null || ts === "") return "";
  return new Date(Number(ts)).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function applyBorders(row, fromCol, toCol) {
  for (let c = fromCol; c <= toCol; c += 1) {
    row.getCell(c).border = THIN_BORDER;
  }
}

function styleHeaderRow(row, colCount) {
  row.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.height = 22;
  applyBorders(row, 1, colCount);
}

function styleSectionTitle(row, colCount, title) {
  row.getCell(1).value = title;
  row.font = { bold: true, size: 12, color: { argb: SECTION_FG } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECTION_BG } };
  row.height = 24;
  if (colCount > 1) {
    try {
      row.worksheet.mergeCells(row.number, 1, row.number, colCount);
    } catch {
      /* already merged */
    }
  }
  applyBorders(row, 1, colCount);
}

function styleDataRow(row, colCount, alt) {
  if (alt) {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= colCount) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
      }
    });
  }
  row.alignment = { vertical: "middle" };
  applyBorders(row, 1, colCount);
}

function paintCell(cell, palette, bold = false) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.bg } };
  cell.font = { color: { argb: palette.fg }, bold };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

function paintMetricValue(cell, palette) {
  cell.font = { bold: true, color: { argb: palette.fg }, size: 12 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.bg } };
  cell.alignment = { vertical: "middle", horizontal: "right" };
}

function paintCountCell(cell, value, kind) {
  const n = Number(value) || 0;
  const palettes = {
    danger: n > 0 ? { bg: "FFFEF2F2", fg: "FFDC2626" } : { bg: "FFFFFFFF", fg: "FF9CA3AF" },
    warn: n > 0 ? { bg: "FFFFF7ED", fg: "FFEA580C" } : { bg: "FFFFFFFF", fg: "FF9CA3AF" },
    success: n > 0 ? { bg: "FFECFDF5", fg: "FF059669" } : { bg: "FFFFFFFF", fg: "FF9CA3AF" },
    neutral: { bg: "FFFFFFFF", fg: "FF111827" },
  };
  paintCell(cell, palettes[kind], n > 0);
  cell.value = value ?? 0;
}

function autoWidth(sheet, max = 44) {
  sheet.columns.forEach((col) => {
    let w = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len + 2 > w) w = Math.min(len + 2, max);
    });
    col.width = w;
  });
}

function addTableSection(sheet, title, headers, rows, colStyles) {
  const colCount = headers.length;
  sheet.addRow([]);
  const titleRow = sheet.addRow([title]);
  styleSectionTitle(titleRow, colCount, title);

  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow, colCount);

  rows.forEach((values, idx) => {
    const row = sheet.addRow(values);
    styleDataRow(row, colCount, idx % 2 === 1);
    colStyles?.forEach((style, colIdx) => {
      if (style) style(row.getCell(colIdx + 1), values[colIdx], idx);
    });
  });
}

export async function buildReportsWorkbook({ reportData, tasks }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TaskFlow";
  wb.created = new Date();

  const summarySheet = wb.addWorksheet("Report", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  const s = reportData.summary;

  const metricRows = [
    ["Open tasks", s.open, { bg: "FFEEF2FF", fg: "FF4F46E5" }],
    ["Overdue", s.overdue, { bg: "FFFEF2F2", fg: "FFDC2626" }],
    ["No response (SLA breach)", s.noResponse, { bg: "FFFEF2F2", fg: "FFDC2626" }],
    ["Escalations awaiting explanation", s.escalatedAwaiting, { bg: "FFFFF7ED", fg: "FFEA580C" }],
    ["Escalations pending review", s.escalatedPendingReview, { bg: "FFFFFBEB", fg: "FFD97706" }],
    ["Due this week", s.dueThisWeek, { bg: "FFF0F9FF", fg: "FF0284C7" }],
    ["Done", s.done, { bg: "FFECFDF5", fg: "FF059669" }],
    ["On-time completion %", s.onTimePct != null ? `${s.onTimePct}%` : "—", { bg: "FFECFDF5", fg: "FF059669" }],
    ["Avg response time (min)", s.avgResponseMin ?? "—", { bg: "FFF5F3FF", fg: "FF7C3AED" }],
  ];

  const summaryTitle = summarySheet.addRow(["Summary"]);
  styleSectionTitle(summaryTitle, 2, "Summary");
  const summaryHeader = summarySheet.addRow(["Metric", "Value"]);
  styleHeaderRow(summaryHeader, 2);

  metricRows.forEach(([label, value, palette], idx) => {
    const row = summarySheet.addRow([label, value ?? "—"]);
    styleDataRow(row, 2, idx % 2 === 1);
    paintMetricValue(row.getCell(2), palette);
    row.getCell(1).font = { color: { argb: "FF374151" } };
  });

  if (reportData.people?.length) {
    addTableSection(
      summarySheet,
      reportData.scope === "MEMBER" ? "Your performance" : "By person",
      ["Person", "Team", "Open", "Overdue", "No resp.", "Escalations", "Done", "Done on time", "Avg resp. (min)"],
      reportData.people.map((p) => [
        p.name,
        p.team_name ?? "",
        p.open,
        p.overdue,
        p.no_response,
        p.escalations,
        p.done,
        p.done_ontime,
        p.avg_response_min ?? "",
      ]),
      [
        undefined,
        undefined,
        undefined,
        (cell, v) => paintCountCell(cell, v, "danger"),
        (cell, v) => paintCountCell(cell, v, "danger"),
        (cell, v) => paintCountCell(cell, v, "warn"),
        (cell, v) => paintCountCell(cell, v, "success"),
        (cell, v) => paintCountCell(cell, v, "success"),
        undefined,
      ]
    );
  }

  if (reportData.byType?.length) {
    addTableSection(
      summarySheet,
      "By task type",
      ["Task type", "Team", "Total", "Open", "Overdue", "No resp.", "Done"],
      reportData.byType.map((bt) => [
        bt.name,
        bt.team_name ?? "",
        bt.total,
        bt.open,
        bt.overdue,
        bt.no_response,
        bt.done,
      ]),
      [
        undefined,
        undefined,
        undefined,
        undefined,
        (cell, v) => paintCountCell(cell, v, "danger"),
        (cell, v) => paintCountCell(cell, v, "danger"),
        (cell, v) => paintCountCell(cell, v, "success"),
      ]
    );
  }

  autoWidth(summarySheet);

  const tasksSheet = wb.addWorksheet("Tasks", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  const taskHeaders = [
    "ID",
    "Title",
    "Status",
    "Assignee",
    "Creator",
    "Team",
    "Task type",
    "Priority",
    "Due",
    "ETA",
    "Created",
    "Comments",
  ];
  const colCount = taskHeaders.length;

  const tasksTitle = tasksSheet.addRow(["Tasks"]);
  styleSectionTitle(tasksTitle, colCount, `Tasks (${tasks.length})`);
  const taskHeaderRow = tasksSheet.addRow(taskHeaders);
  styleHeaderRow(taskHeaderRow, colCount);

  tasks.forEach((t, idx) => {
    const statusKey = String(t.status || "");
    const statusLabel = STATUS_LABEL[statusKey] || statusKey;
    const row = tasksSheet.addRow([
      t.id,
      t.title,
      statusLabel,
      t.assignee_name ?? "",
      t.creator_name ?? "",
      t.team_name ?? "",
      t.type_name ?? "",
      t.priority ?? "",
      t.due_at ? fmtDateTime(t.due_at) : "",
      t.eta_at ? fmtDateTime(t.eta_at) : "",
      t.created_at ? fmtDateTime(t.created_at) : "",
      t.comment_count ?? 0,
    ]);
    styleDataRow(row, colCount, idx % 2 === 1);

    const statusPalette = STATUS_EXCEL[statusKey] || STATUS_FALLBACK;
    paintCell(row.getCell(3), statusPalette, true);

    const priority = String(t.priority || "");
    if (PRIORITY_EXCEL[priority]) {
      row.getCell(8).font = {
        bold: priority === "URGENT" || priority === "HIGH",
        color: { argb: PRIORITY_EXCEL[priority] },
      };
    }

    const rowTint = STATUS_EXCEL[statusKey]?.bg || "FFFFFFFF";
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber === 3) return;
      if (colNumber <= colCount && idx % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowTint } };
      }
    });
  });

  autoWidth(tasksSheet);

  return wb.xlsx.writeBuffer();
}

export default { buildReportsWorkbook };
