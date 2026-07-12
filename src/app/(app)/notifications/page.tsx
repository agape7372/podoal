'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import ReminderModal from '@/components/ReminderModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmojiIcon from '@/components/EmojiIcon';
import EmptyState from '@/components/EmptyState';
import type { NotificationSettingInfo, ReminderInfo, BoardSummary } from '@/types';
import { stripTitleEmoji } from '@/lib/title';
import { usePush } from '@/lib/usePush';
import { useAppStore } from '@/lib/store';
// 공용 `src/components/Toggle.tsx`가 정본 (2026-07-13 FE-1) — size:'large' 변형은 그대로 지원.
import Toggle from '@/components/Toggle';
import RetryButton from '@/components/RetryButton';

const DAY_LABELS: Record<string, string> = {
  '1': '월', '2': '화', '3': '수', '4': '목', '5': '금', '6': '토', '7': '일',
};

const CATEGORY_ITEMS = [
  { key: 'cheerEnabled' as const, icon: '💜', label: '응원 메시지', desc: '친구가 보낸 응원 알림' },
  { key: 'rewardEnabled' as const, icon: '🎁', label: '보상 알림', desc: '보상이 열렸을 때 알림' },
  { key: 'relayEnabled' as const, icon: '🔗', label: '릴레이 알림', desc: '릴레이 순서 및 완료 알림' },
  { key: 'reminderEnabled' as const, icon: '⏰', label: '리마인더 알림', desc: '설정한 리마인더 알림' },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettingInfo | null>(null);
  const [reminders, setReminders] = useState<ReminderInfo[]>([]);
  const [boards, setBoards] = useState<{ id: string; title: string; cadenceType?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderInfo | undefined>(undefined);
  const [deletingReminderId, setDeletingReminderId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, remindersRes, boardsRes] = await Promise.all([
        api<{ settings: NotificationSettingInfo }>('/api/notifications/settings'),
        api<{ reminders: ReminderInfo[] }>('/api/notifications/reminders'),
        api<{ boards: BoardSummary[] }>('/api/boards'),
      ]);

      setSettings(settingsRes.settings);
      setReminders(remindersRes.reminders);
      setBoards(
        boardsRes.boards
          .filter((b) => !b.isCompleted)
          .map((b) => ({ id: b.id, title: b.title, cadenceType: b.cadenceType }))
      );
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateSetting = async (key: string, value: boolean | string) => {
    if (!settings) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      await api('/api/notifications/settings', {
        method: 'PUT',
        json: { [key]: value },
      });
    } catch {
      // Revert on error
      setSettings(settings);
    }
  };

  const toggleReminderActive = async (reminder: ReminderInfo) => {
    const newActive = !reminder.isActive;
    setReminders((prev) =>
      prev.map((r) => (r.id === reminder.id ? { ...r, isActive: newActive } : r))
    );

    try {
      await api(`/api/notifications/reminders/${reminder.id}`, {
        method: 'PUT',
        json: { isActive: newActive },
      });
    } catch {
      // Revert on error
      setReminders((prev) =>
        prev.map((r) => (r.id === reminder.id ? { ...r, isActive: !newActive } : r))
      );
    }
  };

  const deleteReminder = async (id: string) => {
    const prev = reminders;
    setReminders((r) => r.filter((rem) => rem.id !== id));

    try {
      await api(`/api/notifications/reminders/${id}`, { method: 'DELETE' });
    } catch {
      setReminders(prev);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingReminder(undefined);
    setShowReminderModal(true);
  };

  const handleOpenEditModal = (reminder: ReminderInfo) => {
    setEditingReminder(reminder);
    setShowReminderModal(true);
  };

  const handleReminderSaved = () => {
    setShowReminderModal(false);
    setEditingReminder(undefined);
    fetchData();
  };

  const push = usePush();

  // 앱에서 메시지를 받는 방식(클라이언트 설정) — 설정 탭에서 이관(REQ7)
  const appSettings = useAppStore((s) => s.settings);
  const updateAppSettings = useAppStore((s) => s.updateSettings);

  if (loading) {
    return (
      <div className="pb-4">
        <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">알림 설정</h1>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="pb-4">
        <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">알림 설정</h1>
        <div className="text-center py-12">
          <p className="text-sm text-warm-text mb-1">알림 설정을 불러오지 못했어요</p>
          <p className="text-xs text-warm-sub mb-5">잠시 후 다시 시도해주세요</p>
          <RetryButton onRetry={fetchData} />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-bold text-grape-700 mb-6">알림 설정</h1>

      {/* Global toggle */}
      <section className="clay p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-warm-text">전체 알림</p>
            <p className="text-xs text-warm-sub mt-0.5">
              {settings.globalEnabled ? '알림이 활성화되어 있어요' : '모든 알림이 꺼져 있어요'}
            </p>
          </div>
          <Toggle
            enabled={settings.globalEnabled}
            onToggle={() => updateSetting('globalEnabled', !settings.globalEnabled)}
            size="large"
            ariaLabel="전체 알림"
          />
        </div>
      </section>

      {/* 메시지 알림 — 앱에서 받는 방식(설정 탭에서 이관, REQ7) */}
      <section className="clay p-5 mb-4">
        <h2 className="text-sm font-semibold text-warm-sub mb-4">메시지 알림</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-text">메시지 팝업</p>
              <p className="text-xs text-warm-sub">새 응원 메시지를 팝업으로 표시</p>
            </div>
            <Toggle
              enabled={appSettings.showMessagePopup}
              onToggle={() => updateAppSettings({ showMessagePopup: !appSettings.showMessagePopup })}
              ariaLabel="메시지 팝업"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-text">실시간 알림</p>
              <p className="text-xs text-warm-sub">앱이 켜져 있을 때 실시간으로 메시지 수신</p>
            </div>
            <Toggle
              enabled={appSettings.realtimeNotifications}
              onToggle={() => updateAppSettings({ realtimeNotifications: !appSettings.realtimeNotifications })}
              ariaLabel="실시간 알림"
            />
          </div>
        </div>
      </section>

      {/* DND section */}
      <section className={`clay p-5 mb-4 transition-opacity ${!settings.globalEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2 className="text-sm font-semibold text-warm-sub mb-4">방해금지 시간</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs text-warm-sub mb-1 ml-1">시작</label>
            <input
              type="time"
              value={settings.dndStart}
              onChange={(e) => updateSetting('dndStart', e.target.value)}
              className="clay-input text-center text-sm font-medium"
            />
          </div>
          <span className="text-warm-sub mt-5">~</span>
          <div className="flex-1">
            <label className="block text-xs text-warm-sub mb-1 ml-1">종료</label>
            <input
              type="time"
              value={settings.dndEnd}
              onChange={(e) => updateSetting('dndEnd', e.target.value)}
              className="clay-input text-center text-sm font-medium"
            />
          </div>
        </div>
        <p className="text-xs text-warm-sub text-center mt-3 tabular-nums">
          {settings.dndStart} ~ {settings.dndEnd} 방해금지
        </p>
      </section>

      {/* Category toggles */}
      <section className={`clay p-5 mb-4 transition-opacity ${!settings.globalEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2 className="text-sm font-semibold text-warm-sub mb-4">카테고리 알림</h2>
        <div className="space-y-4">
          {CATEGORY_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <EmojiIcon emoji={item.icon} size={20} />
                <div>
                  <p className="text-sm font-medium text-warm-text">{item.label}</p>
                  <p className="text-xs text-warm-sub">{item.desc}</p>
                </div>
              </div>
              <Toggle
                enabled={settings[item.key]}
                onToggle={() => updateSetting(item.key, !settings[item.key])}
                ariaLabel={item.label}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Daily nudge — opt-in, 하루 1회 (기본 꺼짐) */}
      <section className={`clay p-5 mb-4 transition-opacity ${!settings.globalEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2 className="text-sm font-semibold text-warm-sub mb-4">데일리 넛지</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <EmojiIcon emoji="🍇" size={20} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-warm-text">하루 한 번 부드러운 응원</p>
              <p className="text-xs text-warm-sub">하루 한 번만 살짝 알려드려요</p>
            </div>
          </div>
          <Toggle
            enabled={settings.dailyNudgeEnabled}
            onToggle={() => updateSetting('dailyNudgeEnabled', !settings.dailyNudgeEnabled)}
            ariaLabel="하루 한 번 부드러운 응원"
          />
        </div>
      </section>

      {/* Weekly recap — opt-out, 일요일 저녁 1회 (기본 켜짐) */}
      <section className={`clay p-5 mb-4 transition-opacity ${!settings.globalEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2 className="text-sm font-semibold text-warm-sub mb-4">주간 결산</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <EmojiIcon emoji="📊" size={20} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-warm-text">일요일 저녁 포도 농사 결산</p>
              <p className="text-xs text-warm-sub">이번 주 채운 포도알을 정리해서 알려드려요</p>
            </div>
          </div>
          <Toggle
            enabled={settings.weeklyRecapEnabled !== false}
            onToggle={() => updateSetting('weeklyRecapEnabled', settings.weeklyRecapEnabled === false)}
            ariaLabel="일요일 저녁 포도 농사 결산"
          />
        </div>
      </section>

      {/* Reminders section */}
      <section className={`clay p-5 mb-4 transition-opacity ${!settings.globalEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-warm-sub">리마인더 관리</h2>
          <button
            onClick={handleOpenCreateModal}
            className="clay-button px-3 py-1.5 rounded-xl text-xs font-medium text-grape-600 bg-grape-50"
          >
            + 리마인더 추가
          </button>
        </div>

        {/* Background push — now actually wired (Web Push / VAPID) */}
        <div className="mb-4 p-3 rounded-xl bg-grape-50/70 border border-grape-100">
          {push.subscribed ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-grape-900 leading-relaxed">
                <EmojiIcon emoji="🔔" size={13} className="mr-0.5" />백그라운드 푸시가 <b>켜져 있어요</b>. 앱을 닫아도 리마인더·선물·응원 알림을 받습니다.
              </p>
              <button onClick={() => push.disable()} disabled={push.busy} className="shrink-0 text-xs font-medium text-warm-sub underline">
                끄기
              </button>
            </div>
          ) : push.supported ? (
            <div>
              <p className="text-xs text-grape-900 leading-relaxed">
                <EmojiIcon emoji="🔔" size={13} className="mr-0.5" /><b>백그라운드 푸시</b>를 켜면 앱을 닫아도 리마인더·선물 도착·응원 알림을 받을 수 있어요.
              </p>
              <button onClick={() => push.enable()} disabled={push.busy} className="mt-2 clay-button px-4 py-2 rounded-xl text-xs font-semibold text-grape-700 bg-grape-100">
                {push.busy ? '설정 중…' : '푸시 알림 켜기'}
              </button>
              {push.permission === 'denied' && (
                <p className="mt-2 text-xs text-amber-800">브라우저 알림 권한이 차단돼 있어요. 설정에서 허용해주세요.</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-900 leading-relaxed">
              <EmojiIcon emoji="⏰" size={13} className="mr-0.5" />리마인더는 <b>앱이 켜져 있는 동안</b> 동작해요. {push.reason}
            </p>
          )}
        </div>

        {reminders.length === 0 ? (
          <EmptyState
            art="/illustrations/empty/empty-reminders-v2.webp"
            fallbackEmoji="⏰"
            artSize={96}
            title="아직 리마인더가 없어요"
            description="리마인더를 추가해서 습관을 잊지 마세요."
            className="py-8"
          />
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`clay-sm p-4 transition-opacity ${!reminder.isActive ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {reminder.type === 'ripe' ? (
                        <span className="font-display text-lg font-bold text-grape-600 flex items-center gap-1">
                          익으면 <EmojiIcon emoji="🍇" size={16} />
                        </span>
                      ) : (
                        <span className="font-display text-lg font-bold text-grape-600 tabular-nums">{reminder.time}</span>
                      )}
                      <span className="text-xs text-warm-sub px-2 py-0.5 rounded-full bg-grape-50">
                        {reminder.boardTitle ? stripTitleEmoji(reminder.boardTitle) : '전체'}
                      </span>
                    </div>
                    <div className="flex gap-1 mb-1">
                      {DAY_VALUES_ARRAY.map((day) => (
                        <span
                          key={day}
                          className={`
                            text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-medium
                            ${reminder.days.split(',').includes(day)
                              ? 'bg-grape-400 text-white'
                              : 'bg-warm-border text-warm-sub'
                            }
                          `}
                        >
                          {DAY_LABELS[day]}
                        </span>
                      ))}
                    </div>
                    {reminder.message && (
                      <p className="text-xs text-warm-sub mt-1 truncate">{reminder.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Toggle
                      enabled={reminder.isActive}
                      onToggle={() => toggleReminderActive(reminder)}
                      ariaLabel={reminder.type === 'ripe' ? '익으면 알림 리마인더 켜기' : `${reminder.time} 리마인더 켜기`}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-2 border-t border-warm-border/30 pt-2">
                  <button
                    onClick={() => handleOpenEditModal(reminder)}
                    className="text-xs text-grape-500 font-medium px-2 py-1"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => setDeletingReminderId(reminder.id)}
                    className="text-xs text-grape-700 font-medium px-2 py-1"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reminder modal */}
      {showReminderModal && (
        <ReminderModal
          reminder={editingReminder}
          boards={boards}
          onSave={handleReminderSaved}
          onClose={() => {
            setShowReminderModal(false);
            setEditingReminder(undefined);
          }}
        />
      )}

      {/* Delete reminder confirmation */}
      <ConfirmDialog
        open={deletingReminderId !== null}
        title="리마인더를 삭제할까요?"
        description="삭제한 리마인더는 다시 되돌릴 수 없어요."
        confirmLabel="삭제"
        destructive
        onConfirm={() => {
          if (deletingReminderId) deleteReminder(deletingReminderId);
          setDeletingReminderId(null);
        }}
        onCancel={() => setDeletingReminderId(null)}
      />
    </div>
  );
}

const DAY_VALUES_ARRAY = ['1', '2', '3', '4', '5', '6', '7'];
