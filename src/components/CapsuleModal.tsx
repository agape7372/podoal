'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import ClayButton from './ClayButton';
import type { TimeCapsuleInfo } from '@/types';

interface CapsuleModalProps {
  boardId: string;
  isOwner: boolean;
  onClose: () => void;
}

const CAPSULE_EMOJIS = ['🍇', '💜', '✨', '🎉', '💪', '🌟', '❤️', '👏', '🔥', '🥳'];

export default function CapsuleModal({ boardId, isOwner, onClose }: CapsuleModalProps) {
  const [tab, setTab] = useState<'create' | 'list'>(isOwner ? 'create' : 'list');
  const [capsules, setCapsules] = useState<TimeCapsuleInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [message, setMessage] = useState('');
  const [emoji, setEmoji] = useState('🍇');
  const [openAt, setOpenAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Opening animation state
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [justOpenedId, setJustOpenedId] = useState<string | null>(null);

  const fetchCapsules = async () => {
    try {
      const data = await api<{ capsules: TimeCapsuleInfo[] }>(`/api/boards/${boardId}/capsules`);
      setCapsules(data.capsules);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapsules();
  }, [boardId]);

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
    const now = new Date();
    const openAtDate = new Date(capsule.openAt);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const openAtStart = new Date(openAtDate.getFullYear(), openAtDate.getMonth(), openAtDate.getDate());
    return todayStart.getTime() >= openAtStart.getTime();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-clay-bg rounded-t-[32px] clay-float p-6 pb-8 safe-bottom animate-slide-up max-h-[85vh] flex flex-col">
        <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

        <h3 className="text-lg font-bold text-grape-700 text-center mb-1">
          💊 동결건조
        </h3>
        <p className="text-sm text-warm-sub text-center mb-5">
          미래의 나에게 보내는 메시지
        </p>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {isOwner && (
            <button
              onClick={() => setTab('create')}
              className={`
                flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
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
            onClick={() => setTab('list')}
            className={`
              flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
              ${tab === 'list'
                ? 'clay-pressed text-grape-600 ring-2 ring-grape-300'
                : 'clay-button text-warm-sub'
              }
            `}
          >
            보관함 ({capsules.length})
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto min-h-0">
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
                <p className="text-xs text-warm-light text-right mt-1">
                  {message.length}/500
                </p>
              </div>

              {/* Emoji selector */}
              <div>
                <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
                  이모지
                </label>
                <div className="flex flex-wrap gap-2">
                  {CAPSULE_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`
                        w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all
                        ${emoji === e
                          ? 'clay-pressed scale-110 ring-2 ring-grape-300'
                          : 'clay-button'
                        }
                      `}
                    >
                      {e}
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
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <ClayButton variant="ghost" onClick={onClose} fullWidth>
                  취소
                </ClayButton>
                <ClayButton
                  variant="primary"
                  onClick={handleCreate}
                  fullWidth
                  loading={submitting}
                  disabled={!message.trim() || !openAt}
                >
                  동결건조 하기 💊
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
              ) : capsules.length === 0 ? (
                <div className="text-center py-12 text-warm-sub">
                  <span className="text-4xl block mb-3">💊</span>
                  <p className="text-sm">아직 동결건조 캡슐이 없어요</p>
                  {isOwner && (
                    <p className="text-xs text-warm-light mt-1">
                      만들기 탭에서 첫 캡슐을 만들어 보세요!
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
                            transition-all duration-500
                            ${isJustOpened ? 'animate-bounce-in ring-2 ring-grape-300' : ''}
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">{capsule.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-warm-text whitespace-pre-wrap break-words">
                                {capsule.message}
                              </p>
                              <p className="text-xs text-warm-light mt-2">
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
                          className="clay-sm p-4 bg-gradient-to-br from-yellow-50 to-orange-50 ring-2 ring-yellow-200"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl animate-float">{capsule.emoji}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-warm-text">
                                개봉할 수 있어요!
                              </p>
                              <p className="text-xs text-warm-light">
                                {formatDate(capsule.openAt)} 개봉 예정이었어요
                              </p>
                            </div>
                            <button
                              onClick={() => handleOpen(capsule.id)}
                              disabled={isCurrentlyOpening}
                              className={`
                                clay-button px-4 py-2 rounded-xl text-sm font-semibold
                                bg-gradient-to-br from-grape-400 to-grape-500 text-white
                                transition-all
                                ${isCurrentlyOpening ? 'opacity-50 cursor-not-allowed' : 'animate-pulse'}
                              `}
                            >
                              {isCurrentlyOpening ? '...' : '개봉하기!'}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Locked capsule: not yet time
                    return (
                      <div
                        key={capsule.id}
                        className="clay-sm p-4 bg-gradient-to-br from-blue-50 to-cyan-50 opacity-80"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl grayscale-[30%]">{capsule.emoji}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-400">
                              🔒 {formatDate(capsule.openAt)} 개봉 예정
                            </p>
                            <p className="text-xs text-blue-300">
                              {formatDate(capsule.createdAt)} 동결건조됨
                            </p>
                          </div>
                          <div className="text-2xl opacity-50">
                            🧊
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Close button at the bottom of list view */}
              {!loading && (
                <div className="pt-2 pb-2">
                  <ClayButton variant="ghost" onClick={onClose} fullWidth>
                    닫기
                  </ClayButton>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
