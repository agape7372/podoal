'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import ReminderModal from '@/components/ReminderModal';
import type { NotificationSettingInfo, ReminderInfo, BoardSummary } from '@/types';

const DAY_LABELS: Record<string, string> = {
  '1': '월', '2': '화', '3': '수', '4': '목', '5': '금', '6': '토', '7': '일',
};

const CATEGORY_ITEMS = [
  { key: 'cheerEnabled' as const, icon: '💜', label: '응원 메시지', desc: '친구가 보낸 응원 알림' },
  { key: 'rewardEnabled' as const, icon: '🎁', label: '보상 알림', desc: '보상이 열렸을 때 알림' },
  { key: 'relayEnabled' as const, icon: '🔗', label: '릴레이 알림', desc: '릴레이 순서 및 완료 알림' },
  { key: 'reminderEnabled' as const, icon: '⏰', label: '리마인더 알림', desc: '설정한 리마인더 알림' },
];

function Toggle({
  enabled,
  onToggle,
  size = 'default',
}: {
  enabled: boolean;
  onToggle: () => void;
  size?: 'default' | 'large';
}) {
  const isLarge = size === 'large';
  return (
    <button
      onClick={onToggle}
      className={`
        ${isLarge ? 'w-14 h-8' : 'w-12 h-7'} rounded-full transition-all duration-200 relative
        ${enabled
          ? 'bg-gradient-to-r from-grape-400 to-grape-500'
          : 'bg-gray-200'
        }
      `}
    >
      <div className={`
        ${isLarge ? 'w-6 h-6' : 'w-5 h-5'} rounded-full bg-white shadow-md absolute top-1
        transition-all duration-200
        ${enabled
          ? isLarge ? 'left-7' : 'left-6'
          : 'left-1'
        }
      `} />
    </button>
  );
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettingInfo | null>(null);
  const [reminders, setReminders] = useState<ReminderInfo[]>([]);
  const [boards, setBoards] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderInfo | undefined>(undefined);

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
          .map((b) => ({ id: b.id, title: b.title }))
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

  if (loading) {
    return (
      <div className="pb-4">
        <h1 className="text-2xl font-bold text-grape-700 mb-6">알림 설정</h1>
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
        <h1 className="text-2xl font-bold text-grape-700 mb-6">알림 설정</h1>
        <div className="text-center py-12 text-warm-sub">
          <p className="text-sm">알림 설정을 불러오지 못했어요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <h1 className="text-2xl font-bold text-grape-700 mb-6">알림 설정</h1>

      {/* Global toggle */}
      <section className="clay p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-warm-text">전체 알림</p>
            <p className="text-xs text-warm-light mt-0.5">
              {settings.globalEnabled ? '알림이 활성화되어 있어요' : '모든 알림이 꺼져 있어요'}
            </p>
          </div>
          <Toggle
            enabled={settings.globalEnabled}
            onToggle={() => updateSetting('globalEnabled', !settings.globalEnabled)}
            size="large"
          />
        </div>
      </section>

      {/* DND section */}
      <section className={`clay p-5 mb-4 transition-opacity ${!settings.globalEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2 className="text-sm font-semibold text-warm-sub mb-4">방해금지 시간</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs text-warm-light mb-1 ml-1">시작</label>
            <input
              type="time"
              value={settings.dndStart}
              onChange={(e) => updateSetting('dndStart', e.target.value)}
              className="clay-input text-center text-sm font-medium"
            />
          </div>
          <span className="text-warm-light mt-5">~</span>
          <div className="flex-1">
            <label className="block text-xs text-warm-light mb-1 ml-1">종료</label>
            <input
              type="time"
              value={settings.dndEnd}
              onChange={(e) => updateSetting('dndEnd', e.target.value)}
              className="clay-input text-center text-sm font-medium"
            />
          </div>
        </div>
        <p className="text-xs text-warm-light text-center mt-3">
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
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-warm-text">{item.label}</p>
                  <p className="text-xs text-warm-light">{item.desc}</p>
                </div>
              </div>
              <Toggle
                enabled={settings[item.key]}
                onToggle={() => updateSetting(item.key, !settings[item.key])}
              />
            </div>
          ))}
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

        {reminders.length === 0 ? (
          <div className="text-center py-8 text-warm-sub">
            <span className="text-3xl block mb-2">⏰</span>
            <p className="text-sm">아직 리마인더가 없어요</p>
            <p className="text-xs text-warm-light mt-1">
              리마인더를 추가해서 습관을 잊지 마세요!
            </p>
          </div>
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
                      <span className="text-lg font-bold text-grape-600">{reminder.time}</span>
                      <span className="text-xs text-warm-light px-2 py-0.5 rounded-full bg-grape-50">
                        {reminder.boardTitle || '전체'}
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
                              : 'bg-gray-100 text-warm-light'
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
                    onClick={() => deleteReminder(reminder.id)}
                    className="text-xs text-red-400 font-medium px-2 py-1"
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
    </div>
  );
}

const DAY_VALUES_ARRAY = ['1', '2', '3', '4', '5', '6', '7'];
