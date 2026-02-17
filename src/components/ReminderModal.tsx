'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { ReminderInfo } from '@/types';

interface ReminderModalProps {
  reminder?: ReminderInfo;
  boards: { id: string; title: string }[];
  onSave: () => void;
  onClose: () => void;
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DAY_VALUES = ['1', '2', '3', '4', '5', '6', '7'];

export default function ReminderModal({ reminder, boards, onSave, onClose }: ReminderModalProps) {
  const [time, setTime] = useState(reminder?.time || '09:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(
    reminder?.days ? reminder.days.split(',') : ['1', '2', '3', '4', '5', '6', '7']
  );
  const [boardId, setBoardId] = useState<string>(reminder?.boardId || '');
  const [message, setMessage] = useState(reminder?.message || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // At least one day required
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort();
    });
  };

  const handleSave = async () => {
    if (!time) {
      setError('시간을 선택해주세요');
      return;
    }
    if (selectedDays.length === 0) {
      setError('최소 하나의 요일을 선택해주세요');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        time,
        days: selectedDays.sort().join(','),
        boardId: boardId || null,
        message: message.trim(),
      };

      if (reminder) {
        await api(`/api/notifications/reminders/${reminder.id}`, {
          method: 'PUT',
          json: payload,
        });
      } else {
        await api('/api/notifications/reminders', {
          method: 'POST',
          json: payload,
        });
      }

      onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-clay-bg rounded-t-[32px] clay-float p-6 pb-8 safe-bottom animate-slide-up max-h-[85vh] flex flex-col">
        <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

        <h3 className="text-lg font-bold text-grape-700 text-center mb-5">
          {reminder ? '리마인더 수정' : '리마인더 추가'}
        </h3>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-5">
          {/* Time picker */}
          <div>
            <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
              알림 시간
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="clay-input text-center text-lg font-semibold"
            />
          </div>

          {/* Day selector */}
          <div>
            <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
              반복 요일
            </label>
            <div className="flex gap-2">
              {DAY_VALUES.map((day, idx) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`
                    flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${selectedDays.includes(day)
                      ? 'bg-gradient-to-br from-grape-400 to-grape-500 text-white shadow-md'
                      : 'clay-button text-warm-sub'
                    }
                  `}
                >
                  {DAY_LABELS[idx]}
                </button>
              ))}
            </div>
          </div>

          {/* Board selector */}
          <div>
            <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
              연결 보드
            </label>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="clay-input"
            >
              <option value="">전체 (보드 지정 없음)</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.title}
                </option>
              ))}
            </select>
          </div>

          {/* Message input */}
          <div>
            <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
              메시지 (선택)
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예: 오늘도 포도알 채우기!"
              maxLength={100}
              className="clay-input"
            />
            <p className="text-xs text-warm-light text-right mt-1">
              {message.length}/100
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 clay-button py-3 rounded-2xl text-sm font-medium text-warm-sub"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              className={`
                flex-1 clay-button py-3 rounded-2xl text-sm font-bold text-white
                bg-gradient-to-r from-grape-400 to-grape-500
                ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
