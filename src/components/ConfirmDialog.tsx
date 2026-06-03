'use client';

import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app confirmation sheet replacing window.confirm() — styleable, focus-trapped
 * to the app, and consistent with the claymorphism modal language (z-[90]).
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="absolute inset-0 bg-warm-text/30" onClick={onCancel} aria-hidden="true" />
      <div className="relative clay-puffy bg-white w-full max-w-xs p-5 text-center animate-fade-in">
        <h2 id="confirm-title" className="font-display text-lg font-bold text-warm-text mb-1.5">
          {title}
        </h2>
        {description && <p className="text-sm text-warm-sub mb-4 leading-relaxed">{description}</p>}
        <div className="flex gap-2.5 mt-2">
          <button
            onClick={onCancel}
            className="clay-button flex-1 py-3 rounded-2xl text-sm font-semibold text-warm-sub"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-2xl text-sm font-bold text-white border-[1.3px] border-warm-border clay-button ${
              destructive ? 'bg-rose-500' : 'bg-grape-600'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
