'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadTaskTemplate, fetchTaskTemplateData } from '@/lib/taskTemplate';
import { importTaskRows, parseTaskImportFile } from '@/lib/taskImport';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/util';
import { useMe } from '@/components/Shell';

const TEMPLATE_ROLES = new Set(['ADMIN', 'CEO']);

export default function TaskBulkMenu({
  className,
  variant = 'outline',
  size = 'default',
  onImported,
}: {
  className?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'xs' | 'lg';
  onImported?: () => void;
}) {
  const me = useMe();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'download' | 'import' | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (!me || !TEMPLATE_ROLES.has(me.role)) return null;

  const onDownload = async () => {
    setErr('');
    setMsg('');
    setBusy('download');
    try {
      const data = await fetchTaskTemplateData();
      await downloadTaskTemplate(data);
      setMsg('Template downloaded');
      toast.success('Template downloaded');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Download failed';
      setErr(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const onImportClick = () => {
    setErr('');
    setMsg('');
    fileRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy('import');
    try {
      const rows = await parseTaskImportFile(file);
      const result = await importTaskRows(rows);
      if (result.errors?.length) {
        const detail = result.errors
          .slice(0, 3)
          .map((x) => `row ${x.row}: ${x.message}`)
          .join('; ');
        const msg = `Created ${result.created} task${result.created === 1 ? '' : 's'}. ${result.errors.length} row(s) skipped — ${detail}`;
        setMsg(msg);
        toast.info(msg);
      } else {
        const msg = `Created ${result.created} task${result.created === 1 ? '' : 's'}`;
        setMsg(msg);
        toast.success(msg);
      }
      onImported?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Import failed';
      setErr(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  return (
    <div className={cn('inline-flex flex-col items-end', className)}>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={onFileChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant={variant} size={size} disabled={disabled} className="gap-1.5">
            {busy === 'download' ? 'Preparing…' : busy === 'import' ? 'Importing…' : 'Bulk tasks'}
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={disabled} onClick={onDownload}>
            <Download className="size-4" />
            Download template
          </DropdownMenuItem>
          <DropdownMenuItem disabled={disabled} onClick={onImportClick}>
            <Upload className="size-4" />
            Import tasks
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {msg && <span className="mt-1 max-w-xs text-right text-[11px] text-emerald-700">{msg}</span>}
      {err && <span className="mt-1 max-w-xs text-right text-[11px] text-red-600">{err}</span>}
    </div>
  );
}
