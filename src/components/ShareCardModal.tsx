'use client';

import { useEffect, useState } from 'react';
import ClayButton from './ClayButton';
import { generateShareCard } from '@/lib/shareCard';
import type { BoardDetail, ShareCardData } from '@/types';

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
  const progress = Math.round((filledCount / board.totalStickers) * 100);

  useEffect(() => {
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
        setImageBlob(blob);
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
        setLoading(false);
      })
      .catch(() => {
        setError('이미지 생성에 실패했어요');
        setLoading(false);
      });

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, userName, filledCount, progress]);

  const handleDownload = () => {
    if (!imageBlob) return;
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
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-clay-bg rounded-t-[32px] clay-float p-6 pb-8 safe-bottom animate-slide-up">
        <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

        <h3 className="text-lg font-bold text-grape-700 text-center mb-1">
          📤 공유 카드
        </h3>
        <p className="text-sm text-warm-sub text-center mb-5">
          나의 포도 달성 현황을 공유해보세요!
        </p>

        {/* Preview */}
        <div className="clay bg-gradient-to-br from-clay-lavender/40 to-white p-4 mb-5 flex items-center justify-center">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-4xl animate-float mb-3">🍇</div>
              <p className="text-sm text-warm-sub">카드 생성 중...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-400">{error}</p>
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
            💾 이미지 저장
          </ClayButton>
          <ClayButton
            variant="primary"
            onClick={handleShare}
            fullWidth
            disabled={!imageBlob}
          >
            📤 공유하기
          </ClayButton>
        </div>
      </div>
    </div>
  );
}
