'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import ClayButton from '@/components/ClayButton';
import Avatar from '@/components/Avatar';
import type { RelayInfo } from '@/types';
import { feedbackTap } from '@/lib/feedback';
import EmojiIcon from '@/components/EmojiIcon';

export default function RelayListPage() {
  const router = useRouter();
  const { relays, setRelays } = useAppStore();
  const user = useAppStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const loadRelays = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    api<{ relays: RelayInfo[] }>('/api/relays')
      .then((data) => setRelays(data.relays))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [setRelays]);

  useEffect(() => {
    loadRelays();
  }, [loadRelays]);

  const activeRelays = relays.filter((r) => r.status === 'active');
  const completedRelays = relays.filter((r) => r.status === 'completed');

  const getActiveParticipant = (relay: RelayInfo) =>
    relay.participants.find((p) => p.status === 'active');

  const getCompletedCount = (relay: RelayInfo) =>
    relay.participants.filter((p) => p.status === 'completed').length;

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">
        <EmojiIcon emoji={'\uD83D\uDD17'} size={24} className="mr-1.5" />포도 릴레이
      </h1>

      {/* Create button */}
      <ClayButton
        fullWidth
        size="lg"
        onClick={() => router.push('/relay/create')}
        className="mb-6"
      >
        새 릴레이 만들기
      </ClayButton>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 w-full" />
          ))}
        </div>
      ) : loadError ? (
        /* Error state */
        <div className="text-center py-12">
          <p className="font-display text-base text-warm-text mb-1.5">불러오지 못했어요</p>
          <p className="text-sm text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <button onClick={loadRelays} className="clay-button px-5 py-2.5 rounded-2xl text-sm font-semibold text-grape-700">다시 불러오기</button>
        </div>
      ) : relays.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16">
          <EmojiIcon emoji={'\uD83D\uDD17'} size={52} className="block mx-auto mb-4" />
          <p className="text-sm leading-relaxed text-warm-sub mb-1">
            아직 릴레이가 없어요
          </p>
          <p className="text-sm leading-relaxed text-warm-sub mb-5">
            친구들과 함께 습관 릴레이를 시작해 보세요!
          </p>
        </div>
      ) : (
        <>
          {/* Active relays */}
          {activeRelays.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-warm-sub mb-3">
                진행중인 릴레이 ({activeRelays.length})
              </h2>
              <div className="space-y-3">
                {activeRelays.map((relay) => {
                  const active = getActiveParticipant(relay);
                  const completed = getCompletedCount(relay);
                  const total = relay.participants.length;
                  const isMyTurn = active?.userId === user?.id;

                  return (
                    <button
                      type="button"
                      key={relay.id}
                      onClick={() => { feedbackTap(); router.push(`/relay/${relay.id}`); }}
                      className="clay p-4 w-full text-left block active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-warm-text">{relay.title}</h3>
                          <p className="text-xs text-warm-sub mt-0.5 tabular-nums">
                            {relay.totalStickers}알 | {total}명 참여
                          </p>
                        </div>
                        {isMyTurn && (
                          <span className="px-2 py-1 rounded-lg bg-grape-100 text-grape-600 text-xs font-semibold animate-pulse">
                            내 차례!
                          </span>
                        )}
                      </div>

                      {/* Participant chain */}
                      <div className="flex items-center gap-1">
                        {relay.participants.map((p, idx) => (
                          <div key={p.id} className="flex items-center">
                            <div
                              className={`relative ${
                                p.status === 'active'
                                  ? 'ring-2 ring-grape-400 ring-offset-1 rounded-full'
                                  : ''
                              }`}
                            >
                              <Avatar
                                avatar={p.user.avatar}
                                size="sm"
                                className={
                                  p.status === 'completed'
                                    ? 'opacity-100'
                                    : p.status === 'active'
                                    ? ''
                                    : 'opacity-40'
                                }
                              />
                              {p.status === 'completed' && (
                                <span className="absolute -bottom-0.5 -right-0.5">
                                  <EmojiIcon emoji={'\u2705'} size={14} />
                                </span>
                              )}
                            </div>
                            {idx < relay.participants.length - 1 && (
                              <div
                                className={`w-4 h-0.5 mx-0.5 ${
                                  p.status === 'completed'
                                    ? 'bg-grape-400'
                                    : 'bg-warm-border'
                                }`}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-warm-sub mb-1">
                          <span>진행률</span>
                          <span className="tabular-nums">{completed}/{total} 완료</span>
                        </div>
                        <div className="w-full h-2 bg-grape-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-grape-400 to-grape-500 rounded-full transition-all duration-500"
                            style={{ width: `${(completed / total) * 100}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed relays */}
          {completedRelays.length > 0 && (
            <div>
              <button
                onClick={() => { feedbackTap(); setShowCompleted(!showCompleted); }}
                className="flex items-center gap-2 text-sm font-semibold text-warm-sub mb-3"
              >
                <span
                  className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}
                >
                  {'\u25B6'}
                </span>
                완료된 릴레이 ({completedRelays.length})
              </button>

              {showCompleted && (
                <div className="space-y-3">
                  {completedRelays.map((relay) => (
                    <button
                      type="button"
                      key={relay.id}
                      onClick={() => router.push(`/relay/${relay.id}`)}
                      className="clay p-4 w-full text-left block bg-leaf-100/60 active:scale-[0.98] transition-transform opacity-80"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-warm-text">{relay.title}</h3>
                          <p className="text-xs text-warm-sub mt-0.5 tabular-nums">
                            {relay.totalStickers}알 | {relay.participants.length}명 참여
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded-lg bg-leaf-100 text-leaf-700 text-xs font-semibold">
                          완료
                        </span>
                      </div>

                      {/* Participant chain */}
                      <div className="flex items-center gap-1">
                        {relay.participants.map((p, idx) => (
                          <div key={p.id} className="flex items-center">
                            <div className="relative">
                              <Avatar avatar={p.user.avatar} size="sm" />
                              <span className="absolute -bottom-0.5 -right-0.5">
                                <EmojiIcon emoji={'\u2705'} size={14} />
                              </span>
                            </div>
                            {idx < relay.participants.length - 1 && (
                              <div className="w-4 h-0.5 mx-0.5 bg-grape-400" />
                            )}
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
