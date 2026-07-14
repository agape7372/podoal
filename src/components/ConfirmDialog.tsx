'use client';

import Modal, { useModalClose } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** While true, the confirm button shows a spinner and both buttons / Esc / backdrop
   *  are inert — the caller keeps the dialog open until its async action resolves.
   *  Optional + defaults off, so existing call sites are unaffected. */
  loading?: boolean;
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
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // 훅은 조건부 return 앞에서 무조건 호출(취소 버튼이 이탈 애니를 거쳐 닫히도록).
  const { closeRef, requestClose } = useModalClose(onCancel);
  if (!open) return null;

  return (
    <Modal
      variant="center"
      unstyled
      onClose={onCancel}
      closeRef={closeRef}
      dismissable={!loading}
      labelledBy="confirm-title"
      backdropClassName="z-90 bg-warm-text/30 px-6"
      sheetClassName="clay-puffy bg-clay-bg w-full max-w-xs p-5 text-center animate-fade-in"
    >
      <h2 id="confirm-title" className="font-display text-lg font-bold text-warm-text mb-1.5">
        {title}
      </h2>
      {description && <p className="text-sm text-warm-sub mb-4 leading-relaxed">{description}</p>}
      <div className="flex gap-2.5 mt-2">
        <button
          type="button"
          onClick={requestClose}
          disabled={loading}
          className="clay-button flex-1 py-3 rounded-2xl text-sm font-semibold text-warm-sub disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          aria-busy={loading}
          className={`flex-1 py-3 rounded-2xl text-sm font-bold text-white border-[1.3px] border-warm-border clay-button disabled:opacity-80 ${
            destructive ? 'bg-rose-500' : 'bg-grape-600'
          }`}
        >
          {loading ? (
            <span
              className="inline-block w-4 h-4 align-[-3px] rounded-full border-2 border-white/40 border-t-white animate-spin"
              aria-hidden="true"
            />
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}
