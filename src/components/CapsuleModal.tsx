'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal, { useModalClose } from './Modal';
import ClayButton from './ClayButton';
import EmojiIcon from './EmojiIcon';
import type { TimeCapsuleInfo } from '@/types';
import { feedbackCapsuleOpen, feedbackSuccess, feedbackTap } from '@/lib/feedback';
import { DEV_TOOLS } from '@/lib/devtools';
import { isCapsuleOpenable } from '@/lib/capsuleTime';

interface CapsuleModalProps {
  boardId: string;
  isOwner: boolean;
  onClose: () => void;
}

const CAPSULE_EMOJIS = ['🍇', '💜', '✨', '🎉', '💪', '🌟', '❤️', '👏', '🔥', '🥳'];

export default function CapsuleModal({ boardId, isOwner, onClose }: CapsuleModalProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  const [tab, setTab] = useState<'create' | 'list'>(isOwner ? 'create' : 'list');
  const [capsules, setCapsules] = useState<TimeCapsuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Create form state
  const [message, setMessage] = useState('');
  const [emoji, setEmoji] = useState('🍇');
  const [openAt, setOpenAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Opening animation state
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [justOpenedId, setJustOpenedId] = useState<string | null>(null);

  const fetchCapsules = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await api<{ capsules: TimeCapsuleInfo[] }>(`/api/boards/${boardId}/capsules`);
      setCapsules(data.capsules);
    } catch {
      // Surface load failures instead of silently showing an empty vault —
      // a swallowed error here looked identical to "no capsules yet".
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchCapsules();
  }, [fetchCapsules]);

  const getTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const handleCreate = async () => {
    if (!message.trim() || !openAt) return;

    setSubmitting(true);
    setError('');

    try {
      await api('/api/boards/' + boardId + '/capsules', {
        method: 'POST',
        json: { message: message.trim(), emoji, openAt },
      });
      setMessage('');
      setEmoji('🍇');
      setOpenAt('');
      feedbackSuccess();
      await fetchCapsules();
      setTab('list');
    } catch (e) {
      setError(e instanceof Error ? e.message : '캡슐 생성에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpen = async (capsuleId: string) => {
    setOpeningId(capsuleId);
    try {
      await api(`/api/capsules/${capsuleId}/open`, { method: 'POST' });
      feedbackCapsuleOpen();
      setJustOpenedId(capsuleId);
      await fetchCapsules();
      // Clear just-opened animation after a delay
      setTimeout(() => setJustOpenedId(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '캡슐을 열 수 없어요');
    } finally {
      setOpeningId(null);
    }
  };

  const isOpenable = (capsule: TimeCapsuleInfo) => {
    if (capsule.isOpened) return false;
    // 서버 /api/capsules/[id]/open과 동일한 정밀 타임스탬프 판정 — 규칙을
    // src/lib/capsuleTime.ts로 추출해 양쪽이 같은 함수를 공유한다.
    // (과거엔 날짜단위 로컬 비교라 개봉일 00:00~09:00 KST에 버튼은 보이는데
    // 서버가 거부하는 불일치가 있었음.)
    // react-hooks/purity가 렌더 중 Date.now()를 막으므로 new Date() 사용.
    return isCapsuleOpenable(capsule.openAt, new Date().getTime());
  };

  // DEV-ONLY: backdate this capsule so it becomes openable right now.
  const handleDevUnlock = async (capsuleId: string) => {
    try {
      await api(`/api/capsules/${capsuleId}/dev-unlock`, { method: 'POST' });
      await fetchCapsules();
    } catch (e) {
      setError(e instanceof Error ? e.message : '개봉 가능하게 만들지 못했어요');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      label="동결건조 — 미래의 나에게 보내는 메시지"
      backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
      sheetClassName="max-h-[85vh] flex flex-col"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

      <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-1">
          <EmojiIcon emoji="💊" size={22} className="mr-1" />동결건조
        </h3>
        <p className="text-sm text-warm-sub text-center mb-5">
          미래의 나에게 보내는 메시지
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {isOwner && (
            <button
              onClick={() => { feedbackTap(); setTab('create'); }}
              className={`
                flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow]
                ${tab === 'create'
                  ? 'clay-pressed text-grape-600 ring-2 ring-grape-300'
                  : 'clay-button text-warm-sub'
                }
              `}
            >
              만들기
            </button>
          )}
          <button
            onClick={() => { feedbackTap(); setTab('list'); }}
            className={`
              flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow]
              ${tab === 'list'
                ? 'clay-pressed text-grape-600 ring-2 ring-grape-300'
                : 'clay-button text-warm-sub'
              }
            `}
          >
            보관함 ({capsules.length})
          </button>
        </div>

        {/* Content area — px-1 so children's ring/scale aren't clipped by the
            overflow-y-auto box (overflow-y:auto silently promotes overflow-x to
            auto, clipping horizontal bleed). */}
        <div className="flex-1 overflow-y-auto min-h-0 px-1 pb-4">
          {tab === 'create' && isOwner && (
            <div className="space-y-4">
              {/* Message textarea */}
              <div>
                <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
                  메시지
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="미래의 나에게 하고 싶은 말을 적어보세요..."
                  maxLength={500}
                  rows={4}
                  className="clay-input resize-none"
                  style={{ minHeight: '100px' }}
                />
                <p className="text-xs text-warm-sub text-right mt-1 tabular-nums">
                  {message.length}/500
                </p>
              </div>

              {/* Emoji selector */}
              <div>
                <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
                  이모지
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CAPSULE_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      aria-pressed={emoji === e}
                      aria-label={`이모지 ${e}`}
                      className={`
                        w-full aspect-square rounded-xl flex items-center justify-center transition-[background-color,box-shadow]
                        ${emoji === e
                          ? 'clay-pressed ring-2 ring-grape-400'
                          : 'clay-button'
                        }
                      `}
                    >
                      <EmojiIcon emoji={e} size={26} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Date picker */}
              <div>
                <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
                  개봉일
                </label>
                <input
                  type="date"
                  value={openAt}
                  min={getTomorrow()}
                  onChange={(e) => setOpenAt(e.target.value)}
                  className="clay-input"
                />
              </div>

              {error && (
                <p className="text-grape-700 text-sm text-center">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <ClayButton variant="ghost" onClick={requestClose} fullWidth>
                  취소
                </ClayButton>
                <ClayButton
                  variant="primary"
                  onClick={handleCreate}
                  fullWidth
                  loading={submitting}
                  disabled={!message.trim() || !openAt}
                >
                  완료
                </ClayButton>
              </div>
            </div>
          )}

          {tab === 'list' && (
            <div>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-20 w-full" />
                  ))}
                </div>
              ) : loadError ? (
                <div className="text-center py-12">
                  <EmojiIcon emoji="😥" size={40} className="block mx-auto mb-3" />
                  <p className="text-sm text-warm-text mb-1">불러오지 못했어요</p>
                  <p className="text-xs text-warm-sub mb-4">잠시 후 다시 시도해주세요</p>
                  <button onClick={fetchCapsules} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
                </div>
              ) : capsules.length === 0 ? (
                <div className="text-center py-12 text-warm-sub">
                  <EmojiIcon emoji="💊" size={40} className="block mx-auto mb-3" />
                  <p className="text-sm">아직 동결건조 캡슐이 없어요</p>
                  {isOwner && (
                    <p className="text-xs text-warm-sub mt-1">
                      만들기 탭에서 첫 캡슐을 만들어 보세요.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {capsules.map((capsule) => {
                    const opened = capsule.isOpened;
                    const canOpen = isOpenable(capsule);
                    const isJustOpened = justOpenedId === capsule.id;
                    const isCurrentlyOpening = openingId === capsule.id;

                    if (opened) {
                      // Opened capsule: show message
                      return (
                        <div
                          key={capsule.id}
                          className={`
                            clay-sm p-4 bg-grape-50
                            transition-[box-shadow] duration-500
                            ${isJustOpened ? 'capsule-open ring-2 ring-grape-300' : ''}
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <EmojiIcon emoji={capsule.emoji} size={26} className="shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-warm-text whitespace-pre-wrap wrap-break-word">
                                {capsule.message}
                              </p>
                              <p className="text-xs text-warm-sub mt-2 tabular-nums">
                                {formatDate(capsule.createdAt)} 작성 &middot; {formatDate(capsule.openAt)} 개봉
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (canOpen) {
                      // Openable capsule: date has passed
                      return (
                        <div
                          key={capsule.id}
                          className="clay-sm p-4 bg-linear-to-br from-yellow-50 to-orange-50 ring-2 ring-yellow-200"
                        >
                          <div className="flex items-center gap-3">
                            <EmojiIcon emoji={capsule.emoji} size={26} className="animate-float" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-warm-text">
                                개봉할 수 있어요.
                              </p>
                              <p className="text-xs text-warm-sub tabular-nums">
                                {formatDate(capsule.openAt)} 개봉 예정이었어요
                              </p>
                            </div>
                            <button
                              onClick={() => handleOpen(capsule.id)}
                              disabled={isCurrentlyOpening}
                              className={`
                                clay-button px-4 py-2 rounded-xl text-sm font-semibold
                                bg-linear-to-br from-grape-400 to-grape-500 text-white
                                transition-[opacity]
                                ${isCurrentlyOpening ? 'opacity-50 cursor-not-allowed' : 'animate-pulse'}
                              `}
                            >
                              {isCurrentlyOpening ? '...' : '개봉하기'}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Locked capsule: not yet time
                    const dleft = Math.max(0, Math.ceil((new Date(capsule.openAt).getTime() - new Date().getTime()) / 86400000));
                    return (
                      <div
                        key={capsule.id}
                        className="clay-sm p-4 bg-grape-50 opacity-80"
                      >
                        <div className="flex items-center gap-3">
                          <EmojiIcon emoji={capsule.emoji} size={26} className="grayscale-30" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-grape-600">
                              <EmojiIcon emoji="🔒" size={13} className="mr-0.5" /> D-{dleft} · {formatDate(capsule.openAt)} 개봉
                            </p>
                            <p className="text-xs text-warm-sub">
                              {formatDate(capsule.createdAt)} 동결건조됨
                            </p>
                          </div>
                          {DEV_TOOLS ? (
                            <button
                              onClick={() => handleDevUnlock(capsule.id)}
                              className="clay-button px-2.5 py-1.5 rounded-lg text-xs font-semibold text-grape-600 shrink-0"
                              title="개발용: openAt을 과거로 바꿔 즉시 개봉 가능하게 만듭니다"
                            >
                              <EmojiIcon emoji="🔧" size={13} className="mr-0.5" />즉시개봉
                            </button>
                          ) : (
                            <div className="opacity-50">
                              <EmojiIcon emoji="🧊" size={26} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Close button at the bottom of list view */}
              {!loading && (
                <div className="pt-2 pb-2">
                  <ClayButton variant="ghost" onClick={requestClose} fullWidth>
                    닫기
                  </ClayButton>
                </div>
              )}
            </div>
          )}
        </div>
    </Modal>
  );
}
