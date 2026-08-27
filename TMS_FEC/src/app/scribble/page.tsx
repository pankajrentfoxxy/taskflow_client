'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Modal from '@/components/Modal';
import Composer from '@/components/Composer';
import { api, apiUpload, timeAgo, toast } from '@/lib/util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import '@excalidraw/excalidraw/index.css';

// Full Excalidraw editor: infinite scrollable/zoomable canvas, freehand pen
// (stylus + touch + mouse), shapes, arrows, text, images, undo/redo, dark mode.
const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-muted-foreground">Loading board…</div> }
);

export default function ScribblePage() {
  const router = useRouter();
  const sceneRef = useRef<{ elements: any[]; appState: any; files: any }>({ elements: [], appState: {}, files: {} });
  const [boards, setBoards] = useState<any[]>([]);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardName, setBoardName] = useState('Untitled board');
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [attachId, setAttachId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [sceneKey, setSceneKey] = useState(0);
  const dirty = useRef(false);
  const nameRef = useRef(boardName);
  nameRef.current = boardName;
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  const onChange = useCallback((elements: any, appState: any, files: any) => {
    sceneRef.current = { elements: elements as any[], appState, files };
    dirty.current = true;
  }, []);

  const buildScene = () => ({
    elements: sceneRef.current.elements || [],
    appState: { viewBackgroundColor: sceneRef.current.appState?.viewBackgroundColor || '#ffffff' },
    files: sceneRef.current.files || {},
  });

  const loadBoards = () => api('/api/boards').then((d) => setBoards(d.boards)).catch(() => {});
  useEffect(() => { loadBoards(); }, []);

  const saveBoard = async () => {
    setSaving(true);
    try {
      const d = await api('/api/boards', {
        method: 'POST',
        body: JSON.stringify({ id: boardId, name: boardName, scene: buildScene() }),
      });
      setBoardId(d.id);
      dirty.current = false;
      loadBoards();
      toast.success(boardId ? 'Board saved' : 'Board created');
    } catch (e) {
      toast.errorFrom(e);
    } finally { setSaving(false); }
  };

  // Autosave every 5s once the board has been saved at least once
  useEffect(() => {
    const iv = setInterval(() => {
      if (dirty.current && boardIdRef.current) {
        api('/api/boards', {
          method: 'POST',
          body: JSON.stringify({ id: boardIdRef.current, name: nameRef.current, scene: buildScene() }),
        }).then(() => { dirty.current = false; }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const openBoard = (b: any) => {
    let scene: any = {};
    try { scene = JSON.parse(b.scene || '{}'); } catch { scene = {}; }
    if (Array.isArray(scene)) scene = { elements: [], appState: {}, files: {} }; // legacy format from v1 pad
    setInitialData({
      elements: scene.elements || [],
      appState: { ...(scene.appState || {}), collaborators: new Map() },
      files: scene.files || {},
      scrollToContent: true,
    });
    setBoardId(b.id);
    setBoardName(b.name);
    setSceneKey((k) => k + 1);
    dirty.current = false;
    setBoardsOpen(false);
  };

  const newBoard = () => {
    setInitialData(null);
    setBoardId(null);
    setBoardName('Untitled board');
    setSceneKey((k) => k + 1);
    dirty.current = false;
    setBoardsOpen(false);
  };

  // Export the WHOLE drawing (full scene bounds, not just the visible part) as one PNG
  const sendAsTask = async () => {
    const { elements, appState, files } = sceneRef.current;
    if (!elements || elements.filter((e: any) => !e.isDeleted).length === 0) {
      toast.error('Draw something first 🙂');
      return;
    }
    setExporting(true);
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements,
        appState: { ...appState, exportBackground: true, viewBackgroundColor: appState?.viewBackgroundColor || '#ffffff' },
        files: files || {},
        mimeType: 'image/png',
        exportPadding: 24,
        maxWidthOrHeight: 4096,
      });
      const fd = new FormData();
      fd.append('file', new File([blob], `${boardName || 'scribble'}.png`, { type: 'image/png' }));
      const d = await apiUpload('/api/uploads', fd);
      setAttachId(d.id);
      setComposerOpen(true);
    } catch (e: any) {
      toast.errorFrom(e, 'Export failed');
    } finally { setExporting(false); }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2">
        <Button asChild variant="ghost" size="icon-sm" className="text-lg font-bold text-muted-foreground hover:text-brand-600" title="Back to TaskFlow">
          <Link href="/home">←</Link>
        </Button>
        <Input
          className="w-44 py-1 text-sm font-semibold"
          value={boardName}
          onChange={(e) => { setBoardName(e.target.value); dirty.current = true; }}
          placeholder="Board name"
        />
        <Button variant="outline" size="xs" onClick={saveBoard} disabled={saving}>
          {saving ? 'Saving…' : boardId ? 'Saved ✓ (auto)' : 'Save board'}
        </Button>
        <Button variant="outline" size="xs" onClick={() => setBoardsOpen(true)}>My boards</Button>
        <div className="flex-1" />
        <Button size="sm" onClick={sendAsTask} disabled={exporting}>
          {exporting ? 'Exporting…' : '📤 Send as Task'}
        </Button>
      </div>

      {/* Excalidraw canvas — infinite, pannable (drag with hand tool / two fingers / space+drag), zoomable */}
      <div className="min-h-0 flex-1">
        <Excalidraw
          key={sceneKey}
          initialData={initialData}
          onChange={onChange}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
              saveAsImage: true,
              clearCanvas: true,
              changeViewBackgroundColor: true,
              toggleTheme: true,
            },
          }}
        />
      </div>

      {/* Boards modal */}
      <Modal open={boardsOpen} onClose={() => setBoardsOpen(false)} title="My boards">
        <Button className="mb-3 w-full" onClick={newBoard}>+ New blank board</Button>
        <div className="space-y-2">
          {boards.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <button type="button" className="flex-1 text-left text-sm font-medium hover:text-brand-600" onClick={() => openBoard(b)}>
                {b.name}
                <span className="block text-[11px] font-normal text-muted-foreground">updated {timeAgo(b.updated_at)}</span>
              </button>
              <Button
                variant="ghost"
                size="xs"
                className="text-red-400 hover:text-red-600"
                onClick={() => api(`/api/boards?id=${b.id}`, { method: 'DELETE' }).then(() => { toast.success('Board deleted'); loadBoards(); }).catch((e) => toast.errorFrom(e))}
              >
                Delete
              </Button>
            </div>
          ))}
          {boards.length === 0 && <div className="py-4 text-center text-sm text-muted-foreground">No saved boards yet.</div>}
        </div>
      </Modal>

      {/* Send-as-task composer with the PNG pre-attached */}
      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={() => router.push('/home')}
        presetAttachmentIds={attachId ? [attachId] : []}
        presetBoardId={boardId}
        presetTitle={boardName !== 'Untitled board' ? boardName : ''}
      />
    </div>
  );
}
