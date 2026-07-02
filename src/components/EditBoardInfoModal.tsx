'use client';

import { useState } from 'react';
import Modal, { useModalClose } from './Modal';
import ClayButton from './ClayButton';
import ClayInput from './ClayInput';
import EmojiIcon from './EmojiIcon';

interface EditBoardInfoModalProps {
  initialTitle: string;
  initialDescription: string;
  /** Optimistic save in the parent; throw to keep the sheet open and show the error. */
  onSave: (next: { title: string; description: string }) => Promise<void>;
  onClose: () => void;
}

/**
 * Owner-only bottom sheet to edit a board's title/description after creation.
 * Mirrors MidRewardModal's skeleton (z-[90] sheet, ClayInput + textarea, error row).
 */
export default function EditBoardInfoModal({ initialTitle, initialDescription, onSave, onClose }: EditBoardInfoModalProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  // 편집 대상은 DB 원본이라 stripTitleEmoji를 적용하지 않은 raw 제목을 그대로 보여준다.
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({ title: title.trim(), description: description.trim() });
      requestClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정하지 못했어요');
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      dismissable={!busy}
      label="포도판 수정"
      backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />
      <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-5">
          <EmojiIcon emoji="✏️" size={20} className="mr-1" />
          포도판 수정
        </h3>

        <div className="mb-4">
          <ClayInput
            label="포도판 제목"
            placeholder="포도판 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="edit-board-desc" className="block text-sm font-medium text-warm-sub mb-2 ml-1">
            설명 (선택)
          </label>
          <textarea
            id="edit-board-desc"
            className="clay-input min-h-[80px] resize-none"
            placeholder="포도판 설명을 적어주세요"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
          />
        </div>

        {error && <p role="alert" className="text-rose-700 text-xs text-center mb-3">{error}</p>}

        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={requestClose} fullWidth disabled={busy}>
            취소
          </ClayButton>
          <ClayButton variant="primary" onClick={save} fullWidth loading={busy}>
            저장
          </ClayButton>
        </div>
    </Modal>
  );
}
