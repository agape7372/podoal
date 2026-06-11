'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import { buildWeeklyRecapData, generateWeeklyRecapCard } from '@/lib/weeklyRecap';
import type { EnhancedStats } from '@/types';
import { feedbackSuccess } from '@/lib/feedback';

interface WeeklyRecapModalProps {
  stats: EnhancedStats;
  userName: string;
  onClose: () => void;
}

// 주간 회고 카드 모달 — ShareCardModal과 동일한 blob 생명주기 패턴
// (생성→objectURL 미리보기→공유/다운로드, cleanup에서 revokeObjectURL).
export default function WeeklyRecapModal({ stats, userName, onClose }: WeeklyRecapModalProps) {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const weekCount = stats.dailyStickers.reduce((sum, d) => sum + d.count, 0);
  const lastDate = stats.dailyStickers[stats.dailyStickers.length - 1]?.date ?? '';

  useEffect(() => {
    // 재실행(부모 stats 재조회 등) 시 직전 URL이 revoke된 채 보이지 않도록
    // 상태를 선리셋하고, 이 effect 런이 만든 URL만 closure로 revoke한다.
    setLoading(true);
    setError('');
    setImageUrl(null);
    setImageBlob(null);

    let objectUrl: string | null = null;
    let cancelled = false;

    generateWeeklyRecapCard(buildWeeklyRecapData(stats, userName))
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
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stats, userName]);

  const handleDownload = () => {
    if (!imageBlob) return;
    feedbackSuccess();
    const url = URL.createObjectURL(imageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `포도알_주간회고_${lastDate || 'card'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!imageBlob) return;

    if (navigator.share) {
      try {
        const file = new File([imageBlob], `포도알_주간회고_${lastDate || 'card'}.png`, {
          type: 'image/png',
        });
        await navigator.share({
          title: '🍇 이번 주 포도 농사',
          text: `이번 주 포도알 ${weekCount}알 달성! - 포도알`,
          files: [file],
        });
      } catch (err) {
        // 사용자 취소(AbortError)가 아니면 다운로드로 폴백
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
      label="주간 회고 카드"
      backdropClassName="z-[90] bg-black/30 backdrop-blur-sm"
      sheetClassName="w-full max-w-lg bg-clay-bg rounded-t-[32px] clay-float p-6 pb-8 safe-bottom animate-slide-up"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

      <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-1">
        <EmojiIcon emoji="🍇" size={22} className="mr-1" />주간 회고 카드
      </h3>
      <p className="text-sm text-warm-sub text-center mb-5">
        이번 주 포도 농사를 카드로 남겨보세요.
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
            alt="주간 회고 카드 미리보기"
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
