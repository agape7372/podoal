'use client';

import { useEffect, useRef, useState } from 'react';
import Modal, { useModalClose } from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';

interface CustomImageModalProps {
  initialImageUrl: string | null;
  /** 이미 클라에서 리사이즈된 이미지 blob을 넘긴다 — 부모가 FormData로 POST. */
  onSave: (image: Blob) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}

const MAX_DIMENSION = 640;
const JPEG_QUALITY = 0.82;

/** 원본 이미지를 최대 640×640(contain, 원본 비율 유지)로 축소해 JPEG blob으로 반환.
 *  실제 원형 크롭은 렌더 시점에 CSS(backgroundSize: cover)가 담당 — 여기선 업로드
 *  용량만 줄인다(스토리지 비용 방어). */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 처리할 수 없어요');
  ctx.drawImage(bitmap, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('이미지를 처리할 수 없어요'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/**
 * 보드 전용 커스텀 알 사진 업로드 바텀시트 — 소유자만 연다.
 * EditBoardInfoModal 스켈레톤(Modal, ClayButton, 에러 행) 재사용.
 */
export default function CustomImageModal({ initialImageUrl, onSave, onRemove, onClose }: CustomImageModalProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // createObjectURL로 만든 blob: URL만 정리(교체·언마운트 시) — initialImageUrl 같은
  // http(s) URL은 revoke 대상이 아니다. cleanup 전용이라 set-state-in-effect 무관.
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택도 onChange가 다시 뜨도록
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('jpg·png·webp 사진만 올릴 수 있어요');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const resized = await resizeImage(file);
      setPendingBlob(resized);
      setPreviewUrl(URL.createObjectURL(resized));
    } catch {
      setError('사진을 불러오지 못했어요');
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    if (!pendingBlob) return;
    setBusy(true);
    setError('');
    try {
      await onSave(pendingBlob);
      requestClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 저장하지 못했어요');
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError('');
    try {
      await onRemove();
      requestClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '되돌리지 못했어요');
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      dismissable={!busy}
      label="알 사진 바꾸기"
      backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />
      <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-2">
        <EmojiIcon emoji="📸" size={20} className="mr-1" />
        알 사진 바꾸기
      </h3>
      <p className="text-xs text-warm-sub text-center mb-5">
        채워진 알이 이 사진으로 보여요 · 나만 볼 수 있어요
      </p>

      <div className="flex justify-center mb-5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="w-28 h-28 rounded-full clay-sm flex items-center justify-center overflow-hidden bg-grape-50"
          style={
            previewUrl
              ? { backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
          aria-label="사진 선택"
        >
          {!previewUrl && <EmojiIcon emoji="📸" size={28} />}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p role="alert" className="text-rose-700 text-xs text-center mb-3">{error}</p>}

      <div className="flex gap-3">
        <ClayButton variant="ghost" onClick={requestClose} fullWidth disabled={busy}>
          취소
        </ClayButton>
        {pendingBlob ? (
          <ClayButton variant="primary" onClick={handleApply} fullWidth loading={busy}>
            적용
          </ClayButton>
        ) : initialImageUrl ? (
          <ClayButton variant="primary" onClick={handleRemove} fullWidth loading={busy}>
            기본으로 되돌리기
          </ClayButton>
        ) : (
          <ClayButton variant="primary" onClick={() => fileInputRef.current?.click()} fullWidth disabled={busy}>
            사진 선택
          </ClayButton>
        )}
      </div>
    </Modal>
  );
}
