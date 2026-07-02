'use client';

import { useState } from 'react';
import Modal, { useModalClose } from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import { api } from '@/lib/api';
import { feedbackSuccess } from '@/lib/feedback';
import { stripTitleEmoji } from '@/lib/title';

interface PlantGiftModalProps {
  board: { id: string; title: string; totalStickers: number; filledCount: number };
  onClose: () => void;
  onPlanted: () => void;
}

export default function PlantGiftModal({ board, onClose, onPlanted }: PlantGiftModalProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  const positions: number[] = [];
  for (let p = board.filledCount; p < board.totalStickers; p++) positions.push(p);

  const [position, setPosition] = useState<number>(positions[Math.floor(positions.length / 2)] ?? board.filledCount);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handlePlant = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/api/boards/${board.id}/plant-gift`, { method: 'POST', json: { position, message: message.trim() } });
      feedbackSuccess();
      onPlanted();
      requestClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '선물을 심지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      label="깜짝 선물 심기"
      backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />
      <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-1">
          <EmojiIcon emoji="🎁" size={22} className="mr-1" />깜짝 선물 심기
        </h3>
        <p className="text-sm text-warm-sub text-center truncate">
          &ldquo;{stripTitleEmoji(board.title)}&rdquo;
        </p>
        <p className="text-sm text-warm-sub text-center mb-5">
          빈 한 칸에 선물을 숨겨둘게요. 채우면 짠!
        </p>

        {positions.length === 0 ? (
          <p className="text-center text-sm text-warm-sub py-6">더 심을 빈 칸이 없어요.</p>
        ) : (
          <>
            <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">어느 칸에 숨길까요?</label>
            <select
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              className="clay-input mb-4"
              aria-label="선물 숨길 위치"
            >
              {positions.map((p) => (
                <option key={p} value={p}>{p + 1}번째 포도알</option>
              ))}
            </select>

            <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">메시지 (선택)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="여기까지 잘 왔어! 같은 깜짝 응원을 적어보세요"
              maxLength={200}
              rows={3}
              className="clay-input resize-none mb-3"
            />
          </>
        )}

        {error && <p role="alert" className="text-rose-700 text-xs text-center mb-3">{error}</p>}

        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={requestClose} fullWidth>취소</ClayButton>
          <ClayButton variant="primary" onClick={handlePlant} fullWidth loading={busy} disabled={positions.length === 0}>
            <EmojiIcon emoji="🎁" size={16} className="mr-1" />선물 심기
          </ClayButton>
        </div>
    </Modal>
  );
}
