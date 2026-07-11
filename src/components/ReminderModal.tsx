'use client';

import { useState } from 'react';
import Modal, { useModalClose } from './Modal';
import { api } from '@/lib/api';
import type { ReminderInfo } from '@/types';
import { stripTitleEmoji } from '@/lib/title';

interface ReminderModalProps {
  reminder?: ReminderInfo;
  boards: { id: string; title: string; cadenceType?: string | null }[];
  onSave: () => void;
  onClose: () => void;
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DAY_VALUES = ['1', '2', '3', '4', '5', '6', '7'];

export default function ReminderModal({ reminder, boards, onSave, onClose }: ReminderModalProps) {
  const { closeRef, requestClose } = useModalClose(onClose);
  const [type, setType] = useState<'time' | 'ripe'>(reminder?.type === 'ripe' ? 'ripe' : 'time');
  const [time, setTime] = useState(reminder?.time || '09:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(
    reminder?.days ? reminder.days.split(',') : ['1', '2', '3', '4', '5', '6', '7']
  );
  const [boardId, setBoardId] = useState<string>(reminder?.boardId || '');
  const [message, setMessage] = useState(reminder?.message || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // "익으면 알림"은 채우는 리듬(cadence)이 있는 보드에만 붙는다 — FREE 보드는 "익음" 개념이 없다.
  const cadenceBoards = boards.filter((b) => b.cadenceType && b.cadenceType !== 'FREE');

  const selectType = (next: 'time' | 'ripe') => {
    setType(next);
    if (next === 'ripe' && !cadenceBoards.some((b) => b.id === boardId)) {
      setBoardId('');
    }
  };

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
    if (type === 'time' && !time) {
      setError('시간을 선택해주세요');
      return;
    }
    if (type === 'ripe' && !boardId) {
      setError('보드를 선택해주세요');
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
        type,
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
    <Modal
      onClose={onClose}
      closeRef={closeRef}
      label={reminder ? '리마인더 수정' : '리마인더 추가'}
      backdropClassName="z-90 bg-black/30 backdrop-blur-xs"
      sheetClassName="max-h-[85vh] flex flex-col"
    >
      <div className="w-12 h-1.5 bg-warm-border rounded-full mx-auto mb-5" />

      <h3 className="font-display text-xl font-bold text-grape-700 text-center mb-5">
          {reminder ? '리마인더 수정' : '리마인더 추가'}
        </h3>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-5">
          {/* Type selector — 시간 지정 vs 익으면 알림(대체 옵션, 신규 채널 아님) */}
          <div>
            <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
              알림 방식
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => selectType('time')}
                aria-pressed={type === 'time'}
                className={`
                  flex-1 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow]
                  ${type === 'time'
                    ? 'bg-linear-to-br from-grape-400 to-grape-500 text-white shadow-clay-sm'
                    : 'clay-button text-warm-sub'
                  }
                `}
              >
                시간 지정
              </button>
              <button
                type="button"
                onClick={() => cadenceBoards.length > 0 && selectType('ripe')}
                aria-pressed={type === 'ripe'}
                disabled={cadenceBoards.length === 0}
                className={`
                  flex-1 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,box-shadow]
                  ${type === 'ripe'
                    ? 'bg-linear-to-br from-grape-400 to-grape-500 text-white shadow-clay-sm'
                    : 'clay-button text-warm-sub'
                  }
                  ${cadenceBoards.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                익으면 알림
              </button>
            </div>
            {type === 'ripe' && (
              <p className="text-xs text-warm-sub mt-2 ml-1">포도알이 익으면 알려드려요.</p>
            )}
            {cadenceBoards.length === 0 && (
              <p className="text-xs text-warm-sub mt-2 ml-1">
                채우는 리듬이 설정된 보드가 있어야 사용할 수 있어요.
              </p>
            )}
          </div>

          {/* Time picker — 시간 지정일 때만 */}
          {type === 'time' && (
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
          )}

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
                  aria-pressed={selectedDays.includes(day)}
                  aria-label={`${DAY_LABELS[idx]}요일`}
                  className={`
                    flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
                    ${selectedDays.includes(day)
                      ? 'bg-linear-to-br from-grape-400 to-grape-500 text-white shadow-clay-sm'
                      : 'clay-button text-warm-sub'
                    }
                  `}
                >
                  {DAY_LABELS[idx]}
                </button>
              ))}
            </div>
          </div>

          {/* Board selector — 익으면 알림은 cadence 보드만(FREE 보드는 "익음" 개념 없음) */}
          <div>
            <label className="block text-sm font-medium text-warm-sub mb-2 ml-1">
              연결 보드
            </label>
            {type === 'ripe' ? (
              <select
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="clay-input"
              >
                <option value="" disabled>보드를 선택해주세요</option>
                {cadenceBoards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {stripTitleEmoji(board.title)}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="clay-input"
              >
                <option value="">전체 (보드 지정 없음)</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {stripTitleEmoji(board.title)}
                  </option>
                ))}
              </select>
            )}
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
            <p className="text-xs text-warm-sub text-right mt-1">
              {message.length}/100
            </p>
          </div>

          {error && (
            <p role="alert" className="text-rose-700 text-sm text-center">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={requestClose}
              className="flex-1 clay-button py-3 rounded-2xl text-sm font-medium text-warm-sub"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={submitting}
              className={`
                flex-1 clay-button py-3 rounded-2xl text-sm font-bold text-white
                bg-linear-to-r from-grape-400 to-grape-500
                ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
    </Modal>
  );
}
