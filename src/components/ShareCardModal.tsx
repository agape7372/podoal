'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import { generateShareCard } from '@/lib/shareCard';
import type { BoardDetail, ShareCardData } from '@/types';
import { feedbackSuccess } from '@/lib/feedback';
import { progressPercent } from '@/lib/format';

interface ShareCardModalProps {
  board: BoardDetail;
  userName: string;
  onClose: () => void;
}

export default function ShareCardModal({ board, userName, onClose }: ShareCardModalProps) {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filledCount = board.stickers.length;
  const progress = progressPercent(filledCount, board.totalStickers);

  useEffect(() => {
    // Reset render state up-front so a re-run (e.g. the parent re-fetches the
    // board) shows the loading spinner instead of the just-revoked old URL, and
    // disables download/share while the new card regenerates (stale blob guard).
    setLoading(true);
    setError('');
    setImageUrl(null);
    setImageBlob(null);

    let objectUrl: string | null = null;
    let cancelled = false;

    const cardData: ShareCardData = {
      title: board.title,
      progress,
      filledCount,
      totalStickers: board.totalStickers,
      userName,
      completedAt: board.completedAt ?? undefined,
    };

    generateShareCard(cardData)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageBlob(blob);
        setImageUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('이미지 생성에 실패했어요');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      // Revoke the URL created by *this* effect run (captured in the closure),
      // not a stale `imageUrl` state value — that was always one render behind.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [board, userName, filledCount, progress]);

  const handleDownload = () => {
    if (!imageBlob) return;
    feedbackSuccess();
    const url = URL.createObjectURL(imageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `포도알_${board.title.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!imageBlob) return;

    if (navigator.share) {
      try {
        const file = new File([imageBlob], `포도알_${board.title}.png`, { type: 'image/png' });
        await navigator.share({
          title: `🍇 ${board.title}`,
          text: `${filledCount}/${board.totalStickers} 포도알 달성! - 포도알`,
          files: [file],
        });
      } catch (err) {
        // User cancelled or share failed - fallback to download
        if ((err as Error).name !== 'AbortError') {
          handleDownload();
        }
      }
    } else {
      handleDownload();
    }
  };

  return (
    <Modal
      onClose={onClose}
      label="공유 카드"
      backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
      sheetClassName="w-full max-w-lg bg-clay-bg rounded-t-clay-lg clay-float p-6 pb-8 safe-bottom animate-slide-up"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

      <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-1">
          <EmojiIcon emoji="📤" size={22} className="mr-1" />공유 카드
        </h3>
        <p className="text-sm text-warm-sub text-center mb-5">
          나의 포도 달성 현황을 공유해보세요.
        </p>

        {/* Preview */}
        <div className="clay p-4 mb-5 flex items-center justify-center">
          {loading ? (
            <div className="text-center py-12">
              <EmojiIcon emoji="🍇" size={40} className="block mx-auto animate-float mb-3" />
              <p className="text-sm text-warm-sub">카드 생성 중...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p role="alert" className="text-sm text-rose-700">{error}</p>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="공유 카드 미리보기"
              className="w-full max-h-[400px] object-contain rounded-xl"
            />
          ) : null}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <ClayButton variant="ghost" onClick={onClose} fullWidth>
            닫기
          </ClayButton>
          <ClayButton
            variant="secondary"
            onClick={handleDownload}
            fullWidth
            disabled={!imageBlob}
          >
            <EmojiIcon emoji="💾" size={16} className="mr-1" />이미지 저장
          </ClayButton>
          <ClayButton
            variant="primary"
            onClick={handleShare}
            fullWidth
            disabled={!imageBlob}
          >
            <EmojiIcon emoji="📤" size={16} className="mr-1" />공유하기
          </ClayButton>
        </div>
    </Modal>
  );
}
