import { useEffect, useRef, useState } from 'react';
import { ARK_TOKENS } from '../../tokens';
import { Btn, Ico } from '../ui';

type Tool = 'rect' | 'free' | 'text';

interface RectStroke { tool: 'rect'; x: number; y: number; w: number; h: number }
interface FreeStroke { tool: 'free'; points: { x: number; y: number }[] }
interface TextStroke { tool: 'text'; x: number; y: number; text: string }
type Stroke = RectStroke | FreeStroke | TextStroke;

interface AnnotateModalProps {
  image: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

const STROKE_COLOR = ARK_TOKENS.markerRed;
const STROKE_WIDTH = 3;
const TEXT_FONT = '20px system-ui, sans-serif';

export function AnnotateModal({ image, onSave, onClose }: AnnotateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drafting, setDrafting] = useState<Stroke | null>(null);
  const [textPrompt, setTextPrompt] = useState<{ x: number; y: number; value: string } | null>(null);
  const [imgReady, setImgReady] = useState(false);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; setImgReady(true); };
    img.onerror = () => { imgRef.current = null; setImgReady(true); };
    img.src = image;
  }, [image]);

  // Redraw on every change
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgReady) return;
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    ctx.strokeStyle = STROKE_COLOR;
    ctx.fillStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const all = drafting ? [...strokes, drafting] : strokes;
    for (const s of all) {
      if (s.tool === 'rect') {
        ctx.strokeRect(s.x, s.y, s.w, s.h);
      } else if (s.tool === 'free') {
        if (s.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
      } else if (s.tool === 'text') {
        ctx.font = TEXT_FONT;
        ctx.fillText(s.text, s.x, s.y);
      }
    }
  }, [strokes, drafting, imgReady]);

  // Map a pointer event to image-space coordinates
  const eventToCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = eventToCanvas(e);
    if (tool === 'text') {
      setTextPrompt({ x, y, value: '' });
      return;
    }
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    if (tool === 'rect') setDrafting({ tool: 'rect', x, y, w: 0, h: 0 });
    else if (tool === 'free') setDrafting({ tool: 'free', points: [{ x, y }] });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drafting) return;
    const { x, y } = eventToCanvas(e);
    if (drafting.tool === 'rect') {
      setDrafting({ ...drafting, w: x - drafting.x, h: y - drafting.y });
    } else if (drafting.tool === 'free') {
      setDrafting({ ...drafting, points: [...drafting.points, { x, y }] });
    }
  };

  const handlePointerUp = () => {
    if (!drafting) return;
    const finished = drafting;
    setDrafting(null);
    if (finished.tool === 'rect' && Math.abs(finished.w) < 2 && Math.abs(finished.h) < 2) return;
    if (finished.tool === 'free' && finished.points.length < 2) return;
    setStrokes((prev) => [...prev, finished]);
  };

  const commitText = () => {
    if (!textPrompt) return;
    if (textPrompt.value.trim()) {
      setStrokes((prev) => [...prev, { tool: 'text', x: textPrompt.x, y: textPrompt.y, text: textPrompt.value }]);
    }
    setTextPrompt(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
    onClose();
  };

  const undo = () => setStrokes((prev) => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: ARK_TOKENS.surface, borderRadius: ARK_TOKENS.r3,
          padding: 16, maxWidth: '95vw', maxHeight: '95vh',
          display: 'flex', flexDirection: 'column', gap: 12,
          boxShadow: ARK_TOKENS.shadow3,
        }}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ToolBtn active={tool === 'rect'} onClick={() => setTool('rect')} label="Rectangle" />
          <ToolBtn active={tool === 'free'} onClick={() => setTool('free')} label="Freehand" />
          <ToolBtn active={tool === 'text'} onClick={() => setTool('text')} label="Text" />
          <div style={{ width: 1, height: 20, background: ARK_TOKENS.border, margin: '0 4px' }} />
          <Btn onClick={undo} disabled={strokes.length === 0}>Undo</Btn>
          <Btn onClick={clear} disabled={strokes.length === 0}>Clear</Btn>
          <div style={{ flex: 1 }} />
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon={<Ico.check size={12} />} onClick={handleSave}>Save</Btn>
        </div>

        {/* Canvas area */}
        <div
          style={{
            position: 'relative', overflow: 'auto',
            border: `1px solid ${ARK_TOKENS.border}`, borderRadius: ARK_TOKENS.r2,
            background: '#F1F4F9',
            maxHeight: 'calc(95vh - 110px)',
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              display: 'block', maxWidth: '100%', height: 'auto',
              cursor: tool === 'text' ? 'text' : 'crosshair',
              touchAction: 'none',
            }}
          />
          {textPrompt && (
            <TextPromptOverlay
              prompt={textPrompt}
              canvasRef={canvasRef}
              onChange={(v) => setTextPrompt({ ...textPrompt, value: v })}
              onCommit={commitText}
              onCancel={() => setTextPrompt(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        border: `1px solid ${active ? ARK_TOKENS.azure : ARK_TOKENS.border}`,
        background: active ? ARK_TOKENS.azureFaint : ARK_TOKENS.surface,
        color: active ? ARK_TOKENS.azureDark : ARK_TOKENS.ink,
        borderRadius: ARK_TOKENS.r,
        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

interface TextPromptOverlayProps {
  prompt: { x: number; y: number; value: string };
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function TextPromptOverlay({ prompt, canvasRef, onChange, onCommit, onCancel }: TextPromptOverlayProps) {
  const canvas = canvasRef.current;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const parentRect = (canvas.parentElement as HTMLElement).getBoundingClientRect();
  const scale = rect.width / canvas.width;
  const left = (prompt.x * scale) + (rect.left - parentRect.left);
  const top = (prompt.y * scale) + (rect.top - parentRect.top) - 22;

  return (
    <input
      autoFocus
      value={prompt.value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      style={{
        position: 'absolute', left, top,
        padding: '2px 6px',
        border: `1px solid ${ARK_TOKENS.markerRed}`,
        background: ARK_TOKENS.surface,
        color: ARK_TOKENS.markerRed,
        borderRadius: 4, fontSize: 16, fontFamily: 'inherit',
        outline: 'none', minWidth: 100,
      }}
      placeholder="Type and press Enter"
    />
  );
}
