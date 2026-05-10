import { useEffect, type ReactNode, type CSSProperties } from 'react';
import { ARK_TOKENS } from '../../tokens';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number | string;
  contentStyle?: CSSProperties;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  width,
  contentStyle,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,10,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: ARK_TOKENS.surface,
          borderRadius: ARK_TOKENS.r3,
          boxShadow: ARK_TOKENS.shadow3,
          maxWidth: '95vw',
          maxHeight: '95vh',
          width,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
