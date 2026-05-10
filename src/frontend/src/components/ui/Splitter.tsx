import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ARK_TOKENS } from '../../tokens';

interface SplitterProps {
  onDrag: (deltaX: number) => void;
}

export function Splitter({ onDrag }: SplitterProps) {
  const lastXRef = useRef<number | null>(null);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    lastXRef.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lastXRef.current == null) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    if (dx !== 0) onDrag(dx);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    lastXRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const active = hover || dragging;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: '0 0 4px',
        width: 4,
        cursor: 'col-resize',
        background: active ? ARK_TOKENS.azure : 'transparent',
        transition: 'background 0.15s',
        zIndex: 5,
        touchAction: 'none',
      }}
    />
  );
}
