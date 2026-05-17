import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ARK_TOKENS } from '../../tokens';
import { Btn, Ico, Modal } from '../ui';

type Tool = 'rect' | 'free' | 'text';

interface RectStroke { tool: 'rect'; x: number; y: number; w: number; h: number }
interface FreeStroke { tool: 'free'; points: { x: number; y: number }[] }
interface TextStroke { tool: 'text'; x: number; y: number; size: number; text: string }
type Stroke = RectStroke | FreeStroke | TextStroke;

type TextPrompt = { x: number; y: number; width: number; height: number; value: string };

interface AnnotateModalProps {
  image: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

const STROKE_COLOR = ARK_TOKENS.markerRed;
const STROKE_WIDTH = 3;
const MIN_BOX_WIDTH = 80;
const MIN_BOX_HEIGHT = 30;

function drawAll(canvas: HTMLCanvasElement, img: HTMLImageElement, strokes: Stroke[]) {
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
  for (const s of strokes) {
    if (s.tool === 'rect') {
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.tool === 'free') {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    } else if (s.tool === 'text') {
      ctx.font = `700 ${s.size}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.lineWidth = Math.max(3, Math.round(s.size * 0.18));
      ctx.strokeStyle = '#fff';
      ctx.strokeText(s.text, s.x, s.y);
      ctx.fillStyle = STROKE_COLOR;
      ctx.fillText(s.text, s.x, s.y);
      // Restore stroke style for any subsequent rect/free strokes
      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = STROKE_WIDTH;
    }
  }
}

export function AnnotateModal({ image, onSave, onClose }: AnnotateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('rect');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drafting, setDrafting] = useState<Stroke | null>(null);
  const [textPrompt, setTextPrompt] = useState<TextPrompt | null>(null);
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
    drawAll(canvas, img, drafting ? [...strokes, drafting] : strokes);
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
      if (textPrompt) return; // an existing prompt is already open; require OK/Cancel first
      const canvas = canvasRef.current;
      if (!canvas) return;
      const defaultWidth = Math.max(160, canvas.width * 0.18);
      const defaultHeight = Math.max(MIN_BOX_HEIGHT, canvas.height * 0.07);
      setTextPrompt({ x, y, width: defaultWidth, height: defaultHeight, value: '' });
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
      setStrokes((prev) => [...prev, {
        tool: 'text',
        x: textPrompt.x,
        y: textPrompt.y,
        size: textPrompt.height,
        text: textPrompt.value,
      }]);
    }
    setTextPrompt(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const pendingText: Stroke[] =
      textPrompt && textPrompt.value.trim()
        ? [{
            tool: 'text',
            x: textPrompt.x,
            y: textPrompt.y,
            size: textPrompt.height,
            text: textPrompt.value,
          }]
        : [];
    drawAll(canvas, img, [...strokes, ...pendingText]);
    onSave(canvas.toDataURL('image/png'));
    onClose();
  };

  const undo = () => setStrokes((prev) => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  return (
    <Modal open onClose={onClose} contentStyle={{ padding: 16, gap: 12 }}>
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
            onMove={(x, y) => setTextPrompt({ ...textPrompt, x, y })}
            onResize={(width, height) => setTextPrompt({ ...textPrompt, width, height })}
            onCommit={commitText}
            onCancel={() => setTextPrompt(null)}
          />
        )}
      </div>
    </Modal>
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
        fontSize: ARK_TOKENS.type.label, fontWeight: ARK_TOKENS.weight.semibold, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

interface TextPromptOverlayProps {
  prompt: TextPrompt;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onChange: (v: string) => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function TextPromptOverlay({
  prompt, canvasRef, onChange, onMove, onResize, onCommit, onCancel,
}: TextPromptOverlayProps) {
  const canvas = canvasRef.current;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / canvas.width;

  const boxLeft = rect.left + prompt.x * scale;
  const boxTop = rect.top + prompt.y * scale;
  const boxWidth = prompt.width * scale;
  const boxHeight = prompt.height * scale;
  // Match what the canvas will render after commit.
  const fontSize = boxHeight;

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startCX = e.clientX;
    const startCY = e.clientY;
    const startX = prompt.x;
    const startY = prompt.y;
    const onMoveEv = (ev: PointerEvent) => {
      const dx = (ev.clientX - startCX) / scale;
      const dy = (ev.clientY - startCY) / scale;
      onMove(startX + dx, startY + dy);
    };
    const onUpEv = () => {
      window.removeEventListener('pointermove', onMoveEv);
      window.removeEventListener('pointerup', onUpEv);
    };
    window.addEventListener('pointermove', onMoveEv);
    window.addEventListener('pointerup', onUpEv);
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startCX = e.clientX;
    const startCY = e.clientY;
    const startW = prompt.width;
    const startH = prompt.height;
    const onMoveEv = (ev: PointerEvent) => {
      const dw = (ev.clientX - startCX) / scale;
      const dh = (ev.clientY - startCY) / scale;
      onResize(
        Math.max(MIN_BOX_WIDTH, startW + dw),
        Math.max(MIN_BOX_HEIGHT, startH + dh),
      );
    };
    const onUpEv = () => {
      window.removeEventListener('pointermove', onMoveEv);
      window.removeEventListener('pointerup', onUpEv);
    };
    window.addEventListener('pointermove', onMoveEv);
    window.addEventListener('pointerup', onUpEv);
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: boxLeft,
        top: boxTop,
        width: boxWidth,
        height: boxHeight,
        zIndex: 2147483647,
      }}
    >
      {/* Translucent box with dashed border (visual only) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255,255,255,0.08)',
          border: `2px dashed ${ARK_TOKENS.markerRed}`,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      />

      {/* Text input fills the box */}
      <input
        autoFocus
        value={prompt.value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
        style={{
          position: 'absolute',
          inset: 0,
          padding: '0 6px',
          border: 'none',
          background: 'transparent',
          color: ARK_TOKENS.markerRed,
          fontSize,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1,
          outline: 'none',
          boxSizing: 'border-box',
        }}
        placeholder="Type..."
      />

      {/* Drag handle (top-left, sticks out) */}
      <div
        title="Drag to move"
        onPointerDown={startDrag}
        style={{
          position: 'absolute',
          left: -10,
          top: -10,
          width: 18,
          height: 18,
          background: ARK_TOKENS.markerRed,
          border: '2px solid #fff',
          borderRadius: 3,
          cursor: 'move',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />

      {/* Resize handle (bottom-right, sticks out) */}
      <div
        title="Drag to resize"
        onPointerDown={startResize}
        style={{
          position: 'absolute',
          right: -10,
          bottom: -10,
          width: 18,
          height: 18,
          background: ARK_TOKENS.markerRed,
          border: '2px solid #fff',
          borderRadius: 3,
          cursor: 'nwse-resize',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />

      {/* OK / Cancel toolbar below the box */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 12px)',
          right: 0,
          display: 'flex',
          gap: 6,
        }}
      >
        <Btn size="sm" onClick={onCancel}>Cancel</Btn>
        <Btn size="sm" variant="primary" onClick={onCommit}>OK</Btn>
      </div>
    </div>,
    document.body,
  );
}
